// Shapes of the JSON returned by the backend. They mirror backend/app/models.py.

export type Mode = 'decision' | 'horizon'

export interface SeriesPoint {
  start_time: string
  actual: number
  forecast: number
  publish_time: string
  horizon_hours: number
  error: number
  band_low: number | null
  band_high: number | null
}

export interface SeriesResponse {
  mode: Mode
  horizon_hours: number | null
  p10_error: number | null
  p90_error: number | null
  points: SeriesPoint[]
}

export interface Summary {
  count: number
  mae?: number | null
  rmse?: number | null
  bias?: number | null
  mape_pct?: number | null
  nmae_pct?: number | null
  p10_error?: number | null
  p50_error?: number | null
  p90_error?: number | null
  p90_abs_error?: number | null
  max_abs_error?: number | null
  mean_actual?: number | null
  mean_forecast?: number | null
}

export interface HourRow {
  hour: number
  mae: number | null
  bias: number | null
  count: number
}

export interface DayRow {
  date: string
  mae: number | null
  bias: number | null
  max_abs_error: number | null
  mean_actual: number | null
  mean_forecast: number | null
  count: number
}

export interface HistogramBin {
  from: number
  to: number
  count: number
}

export interface MetricsResponse {
  mode: Mode
  horizon_hours: number | null
  summary: Summary
  by_hour: HourRow[]
  by_day: DayRow[]
  distribution: HistogramBin[]
}

export interface HorizonRow {
  horizon_hours: number
  mae: number | null
  rmse: number | null
  bias: number | null
  count: number
}

export interface Query {
  mode: Mode
  horizon?: number
  start: string
  end: string
}
