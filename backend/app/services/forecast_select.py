"""
Pick the forecast the buying team would have used for each delivery hour,
and line it up with actual wind generation.

Two modes:
  decision  latest forecast published before the day-ahead cutoff (11:00 UK on D-1)
  horizon   latest forecast published at least N hours before the delivery hour
"""

from __future__ import annotations

import sqlite3
from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

import pandas as pd

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "wind.db"

UK_TZ = "Europe/London"
DECISION_CUTOFF_HOUR = 11  # assumption: day-ahead auction gate closure, 11:00 UK time on D-1
MAX_HORIZON_HOURS = 48

# Delivery days covered by purchase decisions made in January 2026.
DELIVERY_START = pd.Timestamp("2026-01-02", tz=UK_TZ)
DELIVERY_END = pd.Timestamp("2026-02-02", tz=UK_TZ)  # exclusive

Mode = Literal["decision", "horizon"]

SERIES_COLUMNS = ["start_time", "actual", "forecast", "publish_time", "horizon_hours", "error"]


@lru_cache(maxsize=1)
def load_data(db_path: Path = DB_PATH) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load actuals and forecasts from SQLite, with all timestamps as UTC."""
    if not db_path.exists():
        raise FileNotFoundError(f"{db_path} not found. Run: python scripts/ingest.py")

    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
        actuals = pd.read_sql_query("SELECT start_time, generation FROM actuals", conn)
        forecasts = pd.read_sql_query(
            "SELECT publish_time, start_time, generation FROM forecasts", conn
        )

    actuals["start_time"] = pd.to_datetime(actuals["start_time"], utc=True)
    forecasts["start_time"] = pd.to_datetime(forecasts["start_time"], utc=True)
    forecasts["publish_time"] = pd.to_datetime(forecasts["publish_time"], utc=True)
    return actuals, forecasts


def decision_deadline(
    start_time: pd.Series, cutoff_hour: int = DECISION_CUTOFF_HOUR
) -> pd.Series:
    """
    For each delivery time, return the moment the purchase decision had to be
    made: cutoff_hour (UK local time) on the day before delivery, as UTC.
    Done in UK local time so it stays correct across clock changes.
    """
    local = start_time.dt.tz_convert(UK_TZ).dt.tz_localize(None)
    deadline = local.dt.normalize() - pd.Timedelta(days=1) + pd.Timedelta(hours=cutoff_hour)
    return deadline.dt.tz_localize(UK_TZ).dt.tz_convert("UTC")


def select_forecasts(
    forecasts: pd.DataFrame,
    mode: Mode = "decision",
    horizon_hours: Optional[float] = None,
) -> pd.DataFrame:
    """Return one forecast row per delivery time, chosen according to mode."""
    # A forecast for a time that has already started is not a forecast.
    valid = forecasts[forecasts["start_time"] > forecasts["publish_time"]]

    if mode == "decision":
        candidates = valid[valid["publish_time"] <= decision_deadline(valid["start_time"])]
    elif mode == "horizon":
        if horizon_hours is None or not 0 <= horizon_hours <= MAX_HORIZON_HOURS:
            raise ValueError(f"horizon_hours must be between 0 and {MAX_HORIZON_HOURS}")
        lead = valid["start_time"] - valid["publish_time"]
        candidates = valid[lead >= pd.Timedelta(hours=horizon_hours)]
    else:
        raise ValueError(f"Unknown mode: {mode}")

    if candidates.empty:
        return candidates.copy()

    latest = candidates.loc[candidates.groupby("start_time")["publish_time"].idxmax()]
    return latest.reset_index(drop=True)


def build_series(
    actuals: pd.DataFrame,
    forecasts: pd.DataFrame,
    mode: Mode = "decision",
    horizon_hours: Optional[float] = None,
    start: Optional[pd.Timestamp] = None,
    end: Optional[pd.Timestamp] = None,
) -> pd.DataFrame:
    """
    Join actuals with the chosen forecasts. Forecasts are hourly and actuals
    half-hourly, so only on-the-hour slots appear in the result.
    error = forecast - actual (positive means wind was over-forecast,
    so the team would have needed to buy more power than planned).
    """
    chosen = select_forecasts(forecasts, mode, horizon_hours)

    merged = actuals.rename(columns={"generation": "actual"}).merge(
        chosen.rename(columns={"generation": "forecast"}),
        on="start_time",
        how="inner",
    )

    start = start if start is not None else DELIVERY_START
    end = end if end is not None else DELIVERY_END
    merged = merged[(merged["start_time"] >= start) & (merged["start_time"] < end)]

    merged = merged.assign(
        horizon_hours=(merged["start_time"] - merged["publish_time"]).dt.total_seconds() / 3600,
        error=merged["forecast"] - merged["actual"],
    )
    return merged.sort_values("start_time").reset_index(drop=True)[SERIES_COLUMNS]
