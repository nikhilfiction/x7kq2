import math

import pandas as pd

from app.services import metrics


def make_series(rows):
    """rows: (start_time, actual, forecast)"""
    df = pd.DataFrame(
        [{"start_time": pd.Timestamp(t, tz="UTC"), "actual": a, "forecast": f} for t, a, f in rows]
    )
    df["error"] = df["forecast"] - df["actual"]
    return df


SERIES = make_series([
    ("2026-01-10T00:00Z", 10000, 11000),  # +1000
    ("2026-01-10T01:00Z", 10000, 9000),   # -1000
    ("2026-01-10T02:00Z", 10000, 13000),  # +3000
    ("2026-01-11T00:00Z", 500, 500),      #     0, below the MAPE threshold
])


def test_summary_core_numbers():
    s = metrics.summary(SERIES)
    assert s["count"] == 4
    assert s["mae"] == 1250.0                       # (1000 + 1000 + 3000 + 0) / 4
    assert s["bias"] == 750.0                       # (1000 - 1000 + 3000 + 0) / 4
    assert s["rmse"] == round(math.sqrt((1e6 + 1e6 + 9e6 + 0) / 4), 1)
    assert s["mape_pct"] == round((0.1 + 0.1 + 0.3) / 3 * 100, 1)  # 500 MW row excluded


def test_summary_of_empty_series_is_safe():
    assert metrics.summary(SERIES.iloc[0:0]) == {"count": 0}


def test_by_hour_groups_by_uk_hour():
    rows = {r["hour"]: r for r in metrics.by_hour_of_day(SERIES)}
    assert rows[0]["count"] == 2
    assert rows[0]["mae"] == 500.0   # (1000 + 0) / 2
    assert rows[2]["bias"] == 3000.0


def test_by_day_splits_days():
    days = metrics.by_day(SERIES)
    assert [d["date"] for d in days] == ["2026-01-10", "2026-01-11"]
    assert days[0]["count"] == 3


def test_distribution_counts_every_point():
    bins = metrics.error_distribution(SERIES, bin_width=1000)
    assert sum(b["count"] for b in bins) == len(SERIES)


def test_uncertainty_band_uses_error_percentiles():
    band = metrics.uncertainty_band(SERIES)
    assert band["p10_error"] < 0 < band["p90_error"]
