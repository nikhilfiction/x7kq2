import pandas as pd
import pytest

from app.services.forecast_select import build_series, decision_deadline, select_forecasts


def ts(value: str) -> pd.Timestamp:
    return pd.Timestamp(value, tz="UTC")


def make_forecasts(rows):
    return pd.DataFrame(
        [{"publish_time": ts(p), "start_time": ts(s), "generation": g} for p, s, g in rows]
    )


def make_actuals(rows):
    return pd.DataFrame([{"start_time": ts(s), "generation": g} for s, g in rows])


TARGET = "2026-01-10T12:00Z"


def test_decision_picks_latest_forecast_before_cutoff():
    forecasts = make_forecasts([
        ("2026-01-09T04:30Z", TARGET, 100),
        ("2026-01-09T09:30Z", TARGET, 200),
        ("2026-01-09T11:30Z", TARGET, 300),  # after the 11:00 cutoff
    ])
    chosen = select_forecasts(forecasts, mode="decision")
    assert chosen["generation"].tolist() == [200]


def test_decision_includes_forecast_published_exactly_at_cutoff():
    forecasts = make_forecasts([
        ("2026-01-09T09:30Z", TARGET, 200),
        ("2026-01-09T11:00Z", TARGET, 250),
    ])
    chosen = select_forecasts(forecasts, mode="decision")
    assert chosen["generation"].tolist() == [250]


def test_decision_returns_nothing_when_no_forecast_before_cutoff():
    forecasts = make_forecasts([("2026-01-09T15:30Z", TARGET, 100)])
    assert select_forecasts(forecasts, mode="decision").empty


def test_midnight_delivery_uses_previous_day_cutoff():
    forecasts = make_forecasts([
        ("2026-01-09T09:30Z", "2026-01-10T00:00Z", 100),
        ("2026-01-09T15:30Z", "2026-01-10T00:00Z", 200),
    ])
    chosen = select_forecasts(forecasts, mode="decision")
    assert chosen["generation"].tolist() == [100]


def test_decision_deadline_handles_clock_changes():
    starts = pd.Series([ts("2026-01-10T12:00Z"), ts("2026-06-10T12:00Z")])
    deadlines = decision_deadline(starts).tolist()
    assert deadlines == [ts("2026-01-09T11:00Z"), ts("2026-06-09T10:00Z")]  # 11:00 GMT, 11:00 BST


@pytest.mark.parametrize(
    "horizon, expected",
    [(0, 300), (4, 200), (12, 100)],
)
def test_horizon_mode_picks_latest_forecast_at_least_n_hours_ahead(horizon, expected):
    forecasts = make_forecasts([
        ("2026-01-09T09:30Z", TARGET, 100),  # 26.5h ahead
        ("2026-01-10T04:30Z", TARGET, 200),  # 7.5h ahead
        ("2026-01-10T09:30Z", TARGET, 300),  # 2.5h ahead
    ])
    chosen = select_forecasts(forecasts, mode="horizon", horizon_hours=horizon)
    assert chosen["generation"].tolist() == [expected]


def test_forecasts_published_after_the_delivery_time_are_ignored():
    forecasts = make_forecasts([
        ("2026-01-10T09:30Z", TARGET, 100),
        ("2026-01-10T13:00Z", TARGET, 999),
    ])
    chosen = select_forecasts(forecasts, mode="horizon", horizon_hours=0)
    assert chosen["generation"].tolist() == [100]


@pytest.mark.parametrize("horizon", [None, -1, 49])
def test_invalid_horizon_raises(horizon):
    forecasts = make_forecasts([("2026-01-09T09:30Z", TARGET, 100)])
    with pytest.raises(ValueError):
        select_forecasts(forecasts, mode="horizon", horizon_hours=horizon)


def test_build_series_joins_on_the_hour_and_computes_error():
    actuals = make_actuals([(TARGET, 1000), ("2026-01-10T12:30Z", 1100)])
    forecasts = make_forecasts([("2026-01-09T09:30Z", TARGET, 1200)])

    series = build_series(actuals, forecasts, mode="decision")

    assert len(series) == 1
    row = series.iloc[0]
    assert row["actual"] == 1000
    assert row["forecast"] == 1200
    assert row["error"] == 200
    assert row["horizon_hours"] == 26.5
