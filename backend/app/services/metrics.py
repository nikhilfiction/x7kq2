"""
Accuracy metrics for a forecast-vs-actual series (the output of build_series).

All errors are in MW and use error = forecast - actual.
"""

from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd

from app.services.forecast_select import MAX_HORIZON_HOURS, UK_TZ, build_series

# MAPE is meaningless when actual output is close to zero, so ignore hours
# where wind produced less than this.
MAPE_MIN_ACTUAL_MW = 1000


def _num(value) -> Optional[float]:
    """Round to 1 decimal, and turn NaN (from empty data) into None so it is valid JSON."""
    if value is None or pd.isna(value):
        return None
    return round(float(value), 1)


def summary(series: pd.DataFrame) -> dict:
    """Headline numbers for the selected period."""
    if series.empty:
        return {"count": 0}

    error = series["error"]
    abs_error = error.abs()
    mape_rows = series[series["actual"] >= MAPE_MIN_ACTUAL_MW]
    mean_actual = series["actual"].mean()

    return {
        "count": int(len(series)),
        "mae": _num(abs_error.mean()),
        "rmse": _num(np.sqrt((error**2).mean())),
        "bias": _num(error.mean()),
        "mape_pct": _num((mape_rows["error"].abs() / mape_rows["actual"]).mean() * 100),
        "nmae_pct": _num(abs_error.mean() / mean_actual * 100) if mean_actual else None,
        "p10_error": _num(error.quantile(0.10)),
        "p50_error": _num(error.quantile(0.50)),
        "p90_error": _num(error.quantile(0.90)),
        "p90_abs_error": _num(abs_error.quantile(0.90)),
        "max_abs_error": _num(abs_error.max()),
        "mean_actual": _num(mean_actual),
        "mean_forecast": _num(series["forecast"].mean()),
    }


def by_hour_of_day(series: pd.DataFrame) -> list[dict]:
    """Error grouped by UK clock hour (0-23)."""
    if series.empty:
        return []
    hour = series["start_time"].dt.tz_convert(UK_TZ).dt.hour
    grouped = series.groupby(hour)["error"]
    return [
        {"hour": int(h), "mae": _num(g.abs().mean()), "bias": _num(g.mean()), "count": int(len(g))}
        for h, g in grouped
    ]


def by_day(series: pd.DataFrame) -> list[dict]:
    """Error and average generation per UK delivery day."""
    if series.empty:
        return []
    day = series["start_time"].dt.tz_convert(UK_TZ).dt.date
    rows = []
    for d, g in series.groupby(day):
        rows.append(
            {
                "date": d.isoformat(),
                "mae": _num(g["error"].abs().mean()),
                "bias": _num(g["error"].mean()),
                "max_abs_error": _num(g["error"].abs().max()),
                "mean_actual": _num(g["actual"].mean()),
                "mean_forecast": _num(g["forecast"].mean()),
                "count": int(len(g)),
            }
        )
    return rows


def error_distribution(series: pd.DataFrame, bin_width: int = 1000) -> list[dict]:
    """Histogram of errors in fixed-width MW buckets."""
    if series.empty:
        return []
    error = series["error"]
    low = int(np.floor(error.min() / bin_width) * bin_width)
    high = int(np.ceil(error.max() / bin_width) * bin_width) + bin_width
    counts, edges = np.histogram(error, bins=np.arange(low, high + 1, bin_width))
    return [
        {"from": int(edges[i]), "to": int(edges[i + 1]), "count": int(counts[i])}
        for i in range(len(counts))
    ]


def by_horizon(
    actuals: pd.DataFrame,
    forecasts: pd.DataFrame,
    start: Optional[pd.Timestamp] = None,
    end: Optional[pd.Timestamp] = None,
    horizons: Optional[list[int]] = None,
) -> list[dict]:
    """How accuracy changes with how far ahead the forecast was made."""
    horizons = horizons if horizons is not None else list(range(0, MAX_HORIZON_HOURS + 1))
    rows = []
    for h in horizons:
        s = build_series(actuals, forecasts, mode="horizon", horizon_hours=h, start=start, end=end)
        stats = summary(s)
        rows.append(
            {
                "horizon_hours": h,
                "mae": stats.get("mae"),
                "rmse": stats.get("rmse"),
                "bias": stats.get("bias"),
                "count": stats["count"],
            }
        )
    return rows


def uncertainty_band(series: pd.DataFrame) -> dict:
    """
    Turn the P10/P90 forecast errors into a likely range for actual output.
    Since actual = forecast - error, the band is
    [forecast - p90_error, forecast - p10_error].
    """
    if series.empty:
        return {"p10_error": None, "p90_error": None}
    return {
        "p10_error": _num(series["error"].quantile(0.10)),
        "p90_error": _num(series["error"].quantile(0.90)),
    }
