import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routes.api import get_data


def ts(value):
    return pd.Timestamp(value, tz="UTC")


@pytest.fixture
def client():
    """API client that uses a small fake dataset instead of wind.db."""
    hours = pd.date_range("2026-01-10T00:00Z", periods=24, freq="h")
    actuals = pd.DataFrame({"start_time": hours, "generation": [10000.0 + i * 100 for i in range(24)]})
    forecasts = pd.DataFrame(
        {
            "publish_time": [ts("2026-01-09T09:30Z")] * 24 + [ts("2026-01-09T15:30Z")] * 24,
            "start_time": list(hours) * 2,
            "generation": [11000.0] * 24 + [99999.0] * 24,  # second run is after the cutoff
        }
    )
    app.dependency_overrides[get_data] = lambda: (actuals, forecasts)
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_series_decision_mode_uses_forecast_before_cutoff(client):
    body = client.get("/api/series", params={"start": "2026-01-10", "end": "2026-01-10"}).json()
    assert len(body["points"]) == 24
    assert all(p["forecast"] == 11000.0 for p in body["points"])
    assert body["points"][0]["band_low"] is not None


def test_series_horizon_mode_requires_horizon(client):
    assert client.get("/api/series", params={"mode": "horizon"}).status_code == 400


def test_horizon_out_of_range_is_rejected(client):
    assert client.get("/api/series", params={"mode": "horizon", "horizon": 99}).status_code == 422


def test_start_after_end_is_rejected(client):
    r = client.get("/api/series", params={"start": "2026-01-12", "end": "2026-01-10"})
    assert r.status_code == 400


def test_metrics_shape(client):
    body = client.get("/api/metrics", params={"start": "2026-01-10", "end": "2026-01-10"}).json()
    assert body["summary"]["count"] == 24
    assert len(body["by_hour"]) == 24
    assert body["distribution"][0].keys() == {"from", "to", "count"}


def test_metrics_by_horizon(client):
    rows = client.get("/api/metrics/by-horizon").json()
    assert len(rows) == 49
    assert rows[0]["horizon_hours"] == 0
