"""Coverage for the picker-facing report ledger endpoint."""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes import reports as reports_route
from app.auth import ClerkUser, require_auth
from app.db.session import SessionLocal, get_session
from app.main import app
from app.models.report import Report
from app.schemas.report import AnomalyVerdict, ReportDraft
from app.services.reports import save_report

USER = ClerkUser(user_id="picker_1", session_id="sess_1", claims={})
NOW = datetime(2026, 10, 26, 12, tzinfo=UTC)
OLD = datetime(1900, 1, 1, tzinfo=UTC)


class FailingSession:
    async def scalar(self, *_args: Any, **_kwargs: Any) -> Any:
        raise SQLAlchemyError("database is down")

    async def execute(self, *_args: Any, **_kwargs: Any) -> Any:
        raise SQLAlchemyError("database is down")


def report_model(*, report_id: UUID | None = None, status: str = "accepted") -> Report:
    return Report(
        id=report_id or uuid4(),
        picker_id=USER.user_id,
        raw_text="fixture",
        material="plastic",
        price_per_kg=Decimal("150"),
        quantity_kg=Decimal("2"),
        currency="PKR",
        city="Multan",
        area=None,
        confidence=0.8,
        is_anomalous=status == "flagged",
        anomaly_reason="No anomaly detected.",
        anomaly_method="mad",
        anomaly_outcome="suspicious" if status == "flagged" else "pass",
        status=status,
        created_at=NOW,
    )


def clear_overrides() -> None:
    app.dependency_overrides.clear()


def test_my_reports_are_scoped_to_the_authenticated_picker(monkeypatch: Any) -> None:
    report = report_model()
    captured: dict[str, Any] = {}

    async def fake_list(_session: Any, **kwargs: Any) -> tuple[list[Report], int]:
        captured.update(kwargs)
        return [report], 1

    monkeypatch.setattr(reports_route, "list_reports_for_picker", fake_list)
    app.dependency_overrides[require_auth] = lambda: USER
    app.dependency_overrides[get_session] = lambda: object()
    try:
        with TestClient(app) as client:
            response = client.get(
                "/api/v1/reports/mine",
                params={"status": "accepted", "page": 2, "page_size": 5},
            )
    finally:
        clear_overrides()

    assert response.status_code == 200
    body = response.json()
    assert body["items"][0]["id"] == str(report.id)
    assert body["items"][0]["material"] == "plastic"
    assert body["total"] == 1
    assert body["page"] == 2
    assert body["page_size"] == 5
    assert captured == {
        "picker_id": USER.user_id,
        "status": "accepted",
        "offset": 5,
        "limit": 5,
    }


def test_my_reports_route_is_not_treated_as_a_report_id(monkeypatch: Any) -> None:
    async def fake_list(*_args: Any, **_kwargs: Any) -> tuple[list[Report], int]:
        return [], 0

    monkeypatch.setattr(reports_route, "list_reports_for_picker", fake_list)
    app.dependency_overrides[require_auth] = lambda: USER
    app.dependency_overrides[get_session] = lambda: object()
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/reports/mine")
    finally:
        clear_overrides()

    assert response.status_code == 200
    assert response.json()["items"] == []


def test_my_reports_rejects_an_unknown_status() -> None:
    app.dependency_overrides[require_auth] = lambda: USER
    app.dependency_overrides[get_session] = lambda: object()
    try:
        with TestClient(app) as client:
            response = client.get(
                "/api/v1/reports/mine",
                params={"status": "not-a-status"},
            )
    finally:
        clear_overrides()

    assert response.status_code == 422


def test_my_reports_returns_service_unavailable_on_database_failure() -> None:
    app.dependency_overrides[require_auth] = lambda: USER
    app.dependency_overrides[get_session] = lambda: FailingSession()
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/reports/mine")
    finally:
        clear_overrides()

    assert response.status_code == 503


async def _real_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


def _draft(*, suspicious: bool, material: str = "plastic") -> ReportDraft:
    return ReportDraft(
        material=material,
        price_per_kg=Decimal("150"),
        quantity_kg=Decimal("2"),
        currency="PKR",
        unit="kg",
        city="Multan",
        area=None,
        observed_at=datetime.now(UTC) - timedelta(hours=1),
    )


def _verdict(*, suspicious: bool) -> AnomalyVerdict:
    return AnomalyVerdict(
        is_anomalous=suspicious,
        reason="Fixture verdict.",
        method="mad",
        confidence=0.8,
        outcome="suspicious" if suspicious else "pass",
        sample_size=5,
    )


async def _persist(
    *,
    picker_id: str,
    suspicious: bool,
    material: str,
    created_at: datetime,
) -> UUID:
    saved = await save_report(
        picker_id=picker_id,
        raw_text=f"fixture {material}",
        draft=_draft(suspicious=suspicious, material=material),
        verdict=_verdict(suspicious=suspicious),
    )
    async with SessionLocal() as session:
        stored = await session.get(Report, saved.id)
        assert stored is not None
        stored.created_at = created_at
        await session.commit()
    return saved.id


async def test_my_reports_endpoint_filters_ownership_and_orders_newest_first(
    postgres_db: None,
) -> None:
    unique = uuid4().hex
    picker_id = f"mine-picker-{unique}"
    other_id = f"other-picker-{unique}"
    created: list[UUID] = []
    try:
        older = await _persist(
            picker_id=picker_id,
            suspicious=False,
            material="plastic",
            created_at=OLD + timedelta(days=1),
        )
        created.append(older)
        newer = await _persist(
            picker_id=picker_id,
            suspicious=True,
            material="paper",
            created_at=OLD + timedelta(days=2),
        )
        created.append(newer)
        foreign = await _persist(
            picker_id=other_id,
            suspicious=False,
            material="iron",
            created_at=OLD + timedelta(days=3),
        )
        created.append(foreign)

        app.dependency_overrides[require_auth] = lambda: ClerkUser(
            user_id=picker_id, session_id=None, claims={}
        )
        app.dependency_overrides[get_session] = _real_session
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://testserver"
            ) as client:
                all_mine = await client.get("/api/v1/reports/mine")
                flagged_only = await client.get(
                    "/api/v1/reports/mine",
                    params={"status": "flagged"},
                )
        finally:
            clear_overrides()

        assert all_mine.status_code == 200, all_mine.text
        body = all_mine.json()
        ids = [item["id"] for item in body["items"]]
        assert ids == [str(newer), str(older)]
        assert str(foreign) not in ids

        assert flagged_only.status_code == 200, flagged_only.text
        flagged_body = flagged_only.json()
        assert [item["id"] for item in flagged_body["items"]] == [str(newer)]
        assert flagged_body["items"][0]["status"] == "flagged"
    finally:
        async with SessionLocal() as session:
            await session.execute(delete(Report).where(Report.id.in_(created)))
            await session.commit()
