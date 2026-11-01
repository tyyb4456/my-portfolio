"""Deletion and redaction helpers for a picker's long-term agent memory."""

from __future__ import annotations

from langgraph.store.base import BaseStore

from app.agents.main_agent import memory_namespace

_PAGE_SIZE = 100
_MAX_PAGES = 1000

# Sentinel returned by :func:`_redact` when a value no longer holds any content
# after the target text is removed. The containing item must then be deleted.
_DROP = object()


def _redact(value: object, text: str) -> object:
    """Return ``value`` with every exact occurrence of ``text`` removed.

    The original object is returned unchanged when it does not contain ``text``.
    A string that becomes blank, or a container whose children are all dropped,
    returns ``_DROP``. Containers are only rebuilt when a child actually
    changes, so unrelated notes keep their exact stored representation.
    """
    if isinstance(value, str):
        if text not in value:
            return value
        remaining = value.replace(text, "")
        if not remaining.strip():
            return _DROP
        return remaining

    if isinstance(value, dict):
        changed = False
        redacted: dict[object, object] = {}
        for key, item in value.items():
            new_key = _redact(key, text)
            new_item = _redact(item, text)
            if new_key is not key or new_item is not item:
                changed = True
            if new_key is _DROP or new_item is _DROP:
                continue
            redacted[new_key] = new_item
        if not changed:
            return value
        if not redacted:
            return _DROP
        return redacted

    if isinstance(value, (list, tuple)):
        changed = False
        redacted_items: list[object] = []
        for item in value:
            new_item = _redact(item, text)
            if new_item is not item:
                changed = True
            if new_item is _DROP:
                continue
            redacted_items.append(new_item)
        if not changed:
            return value
        if not redacted_items:
            return _DROP
        return tuple(redacted_items) if isinstance(value, tuple) else redacted_items

    if isinstance(value, set):
        changed = False
        redacted_set: set[object] = set()
        for item in value:
            new_item = _redact(item, text)
            if new_item is not item:
                changed = True
            if new_item is _DROP:
                continue
            redacted_set.add(new_item)
        if not changed:
            return value
        if not redacted_set:
            return _DROP
        return redacted_set

    return value


async def redact_memory_items_containing(
    *,
    store: BaseStore,
    picker_id: str,
    text: str,
) -> int:
    """Remove an exact text from this picker's memory items, keeping the rest.

    Long-term notes are a shared, freeform document per picker, so deleting a
    whole item because it mentions a report would also erase unrelated notes.
    This redacts only the matching text and deletes an item only when nothing
    meaningful remains. Values are rewritten in place; other pickers are never
    touched. The operation is idempotent and returns the number of items
    modified or deleted.
    """
    if not text:
        return 0

    namespace = memory_namespace(picker_id)
    affected = 0
    offset = 0

    for _ in range(_MAX_PAGES):
        items = await store.asearch(namespace, limit=_PAGE_SIZE, offset=offset)
        if not items:
            return affected

        changed_on_page = 0
        for item in items:
            redacted = _redact(item.value, text)
            if redacted is item.value:
                continue
            if redacted is _DROP or not isinstance(redacted, dict):
                await store.adelete(namespace, item.key)
            else:
                await store.aput(namespace, item.key, redacted)
            affected += 1
            changed_on_page += 1

        if changed_on_page:
            offset = 0
        else:
            offset += len(items)

    raise RuntimeError("Targeted memory redaction did not complete")


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
