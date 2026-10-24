"""HTTP endpoints. Each one loads the data, calls a service function, and returns JSON."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Literal, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query

from app.models import HorizonRow, MetaResponse, MetricsResponse, SeriesResponse
from app.services import metrics
from app.services.forecast_select import (
    DECISION_CUTOFF_HOUR,
    DELIVERY_END,
    DELIVERY_START,
    MAX_HORIZON_HOURS,
    UK_TZ,
    build_series,
    load_data,
)

router = APIRouter(prefix="/api")

ModeParam = Literal["decision", "horizon"]


def get_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Dependency that provides (actuals, forecasts). Tests replace this with fake data."""
    return load_data()


def to_range(start: Optional[date], end: Optional[date]) -> tuple[pd.Timestamp, pd.Timestamp]:
    """Turn inclusive UK delivery dates from the query string into a [start, end) range."""
    start_ts = pd.Timestamp(start, tz=UK_TZ) if start else DELIVERY_START
    end_ts = pd.Timestamp(end + timedelta(days=1), tz=UK_TZ) if end else DELIVERY_END
    if start_ts >= end_ts:
        raise HTTPException(status_code=400, detail="start must be on or before end")
    return start_ts, end_ts


def get_series(data, mode, horizon, start, end) -> pd.DataFrame:
    if mode == "horizon" and horizon is None:
        raise HTTPException(status_code=400, detail="horizon is required when mode=horizon")
    actuals, forecasts = data
    start_ts, end_ts = to_range(start, end)
    return build_series(
        actuals,
        forecasts,
        mode=mode,
        horizon_hours=horizon if mode == "horizon" else None,
        start=start_ts,
        end=end_ts,
    )


# Shared query parameters
MODE = Query("decision", description="decision: latest forecast before 11:00 UK on D-1. horizon: at least N hours ahead.")
HORIZON = Query(None, ge=0, le=MAX_HORIZON_HOURS, description="Hours ahead, used when mode=horizon")
START = Query(None, description="First UK delivery day, YYYY-MM-DD (inclusive)")
END = Query(None, description="Last UK delivery day, YYYY-MM-DD (inclusive)")


@router.get("/meta", response_model=MetaResponse)
def meta(data=Depends(get_data)):
    actuals, forecasts = data
    return {
        "delivery_start": DELIVERY_START.date().isoformat(),
        "delivery_end": (DELIVERY_END - pd.Timedelta(days=1)).date().isoformat(),
        "decision_cutoff_hour_uk": DECISION_CUTOFF_HOUR,
        "max_horizon_hours": MAX_HORIZON_HOURS,
        "actuals_rows": len(actuals),
        "forecast_rows": len(forecasts),
        "forecast_runs": int(forecasts["publish_time"].nunique()),
    }


@router.get("/series", response_model=SeriesResponse)
def series(
    mode: ModeParam = MODE,
    horizon: Optional[float] = HORIZON,
    start: Optional[date] = START,
    end: Optional[date] = END,
    data=Depends(get_data),
):
    s = get_series(data, mode, horizon, start, end)
    band = metrics.uncertainty_band(s)

    if band["p10_error"] is not None:
        s = s.assign(
            band_low=s["forecast"] - band["p90_error"],
            band_high=s["forecast"] - band["p10_error"],
        )

    s = s.round({"actual": 1, "forecast": 1, "error": 1, "horizon_hours": 1, "band_low": 1, "band_high": 1})

    return {
        "mode": mode,
        "horizon_hours": horizon if mode == "horizon" else None,
        "p10_error": band["p10_error"],
        "p90_error": band["p90_error"],
        "points": s.to_dict(orient="records"),
    }


@router.get("/metrics", response_model=MetricsResponse)
def metrics_summary(
    mode: ModeParam = MODE,
    horizon: Optional[float] = HORIZON,
    start: Optional[date] = START,
    end: Optional[date] = END,
    data=Depends(get_data),
):
    s = get_series(data, mode, horizon, start, end)
    return {
        "mode": mode,
        "horizon_hours": horizon if mode == "horizon" else None,
        "summary": metrics.summary(s),
        "by_hour": metrics.by_hour_of_day(s),
        "by_day": metrics.by_day(s),
        "distribution": metrics.error_distribution(s),
    }


@router.get("/metrics/by-horizon", response_model=list[HorizonRow])
def metrics_by_horizon(
    start: Optional[date] = START,
    end: Optional[date] = END,
    data=Depends(get_data),
):
    actuals, forecasts = data
    start_ts, end_ts = to_range(start, end)
    return metrics.by_horizon(actuals, forecasts, start=start_ts, end=end_ts)
