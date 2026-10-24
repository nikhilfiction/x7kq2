"""Response shapes for the API (these also show up in the /docs page)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SeriesPoint(BaseModel):
    start_time: datetime
    actual: float
    forecast: float
    publish_time: datetime
    horizon_hours: float
    error: float
    band_low: Optional[float] = None
    band_high: Optional[float] = None


class SeriesResponse(BaseModel):
    mode: str
    horizon_hours: Optional[float]
    p10_error: Optional[float]
    p90_error: Optional[float]
    points: list[SeriesPoint]


class Summary(BaseModel):
    count: int
    mae: Optional[float] = None
    rmse: Optional[float] = None
    bias: Optional[float] = None
    mape_pct: Optional[float] = None
    nmae_pct: Optional[float] = None
    p10_error: Optional[float] = None
    p50_error: Optional[float] = None
    p90_error: Optional[float] = None
    p90_abs_error: Optional[float] = None
    max_abs_error: Optional[float] = None
    mean_actual: Optional[float] = None
    mean_forecast: Optional[float] = None


class HourRow(BaseModel):
    hour: int
    mae: Optional[float]
    bias: Optional[float]
    count: int


class DayRow(BaseModel):
    date: str
    mae: Optional[float]
    bias: Optional[float]
    max_abs_error: Optional[float]
    mean_actual: Optional[float]
    mean_forecast: Optional[float]
    count: int


class HistogramBin(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_mw: int = Field(alias="from")
    to_mw: int = Field(alias="to")
    count: int


class MetricsResponse(BaseModel):
    mode: str
    horizon_hours: Optional[float]
    summary: Summary
    by_hour: list[HourRow]
    by_day: list[DayRow]
    distribution: list[HistogramBin]


class HorizonRow(BaseModel):
    horizon_hours: int
    mae: Optional[float]
    rmse: Optional[float]
    bias: Optional[float]
    count: int


class MetaResponse(BaseModel):
    delivery_start: str
    delivery_end: str
    decision_cutoff_hour_uk: int
    max_horizon_hours: int
    actuals_rows: int
    forecast_rows: int
    forecast_runs: int
