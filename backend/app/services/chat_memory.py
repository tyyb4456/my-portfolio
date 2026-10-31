"""Deletion helpers for a picker's long-term agent memory."""

from __future__ import annotations

from langgraph.store.base import BaseStore

from app.agents.main_agent import memory_namespace

_PAGE_SIZE = 100
_MAX_PAGES = 1000


def _value_contains_text(value: object, text: str) -> bool:
    """Return whether a stored value contains the exact text in any string."""
    if isinstance(value, str):
        return text in value
    if isinstance(value, dict):
        return any(
            _value_contains_text(key, text) or _value_contains_text(item, text)
            for key, item in value.items()
        )
    if isinstance(value, (list, tuple, set)):
        return any(_value_contains_text(item, text) for item in value)
    return False


async def delete_memory_items_containing(
    *,
    store: BaseStore,
    picker_id: str,
    text: str,
) -> int:
    """Delete only this picker's memory items that contain an exact text.

    This is a narrow companion to :func:`delete_picker_memory` for report
    erasure. Notes are shared across a picker's threads, so deleting the whole
    namespace would remove unrelated notes. Items are looked up page by page;
    the operation is idempotent and never touches another picker.
    """
    if not text:
        return 0

    namespace = memory_namespace(picker_id)
    deleted = 0
    offset = 0

    for _ in range(_MAX_PAGES):
        items = await store.asearch(namespace, limit=_PAGE_SIZE, offset=offset)
        if not items:
            return deleted

        removed_on_page = 0
        for item in items:
            if not _value_contains_text(item.value, text):
                continue
            await store.adelete(namespace, item.key)
            deleted += 1
            removed_on_page += 1

        if removed_on_page:
            offset = 0
        else:
            offset += len(items)

    raise RuntimeError("Targeted memory deletion did not complete")


async def delete_picker_memory(*, store: BaseStore, picker_id: str) -> int:
    """Delete every stored memory item in the picker's namespace.

    Long-term memory lives in a per-picker namespace and is shared across that
    picker's chat threads. Deleting a single thread therefore cannot remove it;
    this function is the explicit erasure path. It is idempotent and returns the
    number of deleted store items.
    """
    namespace = memory_namespace(picker_id)
    deleted = 0

    for _ in range(_MAX_PAGES):
        items = await store.asearch(namespace, limit=_PAGE_SIZE)
        if not items:
            return deleted
        for item in items:
            await store.adelete(namespace, item.key)
            deleted += 1

    raise RuntimeError("Long-term memory deletion did not complete")
