import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getMetrics, getSeries } from '../api'
import ControlBar from '../components/ControlBar'
import Status from '../components/Status'
import { useApi } from '../hooks/useApi'
import { useQuery } from '../hooks/useControls'
import { downloadCsv } from '../lib/csv'
import { dateTimeLabel, dayLabel, fmt, pct, signed } from '../lib/format'
import type { SeriesPoint } from '../types'

const INK = '#17140F'
const ACCENT = '#B4380A'
const GRID = '#DDD6C9'
const MUTED = '#6A6255'
const MONO = "'IBM Plex Mono', ui-monospace, monospace"

interface Row {
  t: number
  actual: number
  forecast: number
  band: [number, number] | null
  point: SeriesPoint
}

export default function ForecastPage() {
  const query = useQuery()
  const deps = [query.mode, query.horizon, query.start, query.end]
  const series = useApi((signal) => getSeries(query, signal), deps)
  const metrics = useApi((signal) => getMetrics(query, signal), deps)

  const rows: Row[] = useMemo(
    () =>
      (series.data?.points ?? []).map((p) => ({
        t: Date.parse(p.start_time),
        actual: p.actual,
        forecast: p.forecast,
        band: p.band_low !== null && p.band_high !== null ? [Math.max(0, p.band_low), p.band_high] : null,
        point: p,
      })),
    [series.data],
  )

  // One tick at UK midnight every few days, spaced to fit the range.
  const ticks = useMemo(() => {
    if (rows.length === 0) return []
    const days = rows.filter((r) => new Date(r.t).getUTCHours() === 0).map((r) => r.t)
    const step = Math.max(1, Math.ceil(days.length / 8))
    return days.filter((_, i) => i % step === 0)
  }, [rows])

  // Round the y axis up to a whole number of 4,000 MW steps.
  const yTicks = useMemo(() => {
    const max = rows.reduce((m, r) => Math.max(m, r.actual, r.forecast, r.band?.[1] ?? 0), 0)
    const top = Math.max(4000, Math.ceil(max / 4000) * 4000)
    return Array.from({ length: top / 4000 + 1 }, (_, i) => i * 4000)
  }, [rows])

  const summary = metrics.data?.summary
  const bias = summary?.bias ?? null

  function exportCsv() {
    downloadCsv(
      `wind-forecast-${query.mode}-${query.start}-to-${query.end}.csv`,
      ['start_time_utc', 'actual_mw', 'forecast_mw', 'error_mw', 'forecast_published_utc', 'hours_ahead', 'likely_low_mw', 'likely_high_mw'],
      rows.map((r) => [
        r.point.start_time, r.actual, r.forecast, r.point.error, r.point.publish_time,
        r.point.horizon_hours, r.point.band_low, r.point.band_high,
      ]),
    )
  }

  return (
    <>
      <ControlBar />

      <section aria-label="Key figures" className="figures">
        <div className="figure">
          <span className="figure-label">Typical error (MAE)</span>
          <span className="figure-value">{fmt(summary?.mae)} <small>MW</small></span>
          <span className="figure-note">{pct(summary?.nmae_pct)} of average wind output</span>
        </div>
        <div className="figure">
          <span className="figure-label">Bias</span>
          <span className="figure-value">{signed(bias)} <small>MW</small></span>
          <span className="figure-note">
            {bias === null ? ' ' : bias >= 0 ? 'Forecast ran high on average' : 'Forecast ran low on average'}
          </span>
        </div>
        <div className="figure">
          <span className="figure-label">9 in 10 hours were within</span>
          <span className="figure-value accent">&plusmn;{fmt(summary?.p90_abs_error)} <small>MW</small></span>
          <span className="figure-note">A starting point for the safety margin</span>
        </div>
        <div className="figure">
          <span className="figure-label">Hours compared</span>
          <span className="figure-value">{fmt(summary?.count)}</span>
          <span className="figure-note">{dayLabel(`${query.start}T12:00Z`)} to {dayLabel(`${query.end}T12:00Z`)}, hourly</span>
        </div>
      </section>

      <section aria-label="Actual against forecast" className="section">
        <div className="section-head">
          <div className="legend">
            <span><i className="swatch-line" style={{ background: INK }} />Actual generation</span>
            <span><i className="swatch-line" style={{ background: ACCENT }} />Forecast used</span>
            <span className="muted"><i className="swatch-band" />Likely range (P10 to P90)</span>
          </div>
          <button type="button" className="button" onClick={exportCsv} disabled={rows.length === 0}>
            Download CSV
          </button>
        </div>

        <Status loading={series.loading} error={series.error} hasData={rows.length > 0} />
        {!series.error && rows.length === 0 && !series.loading && (
          <p className="notice">No hours to show for this selection.</p>
        )}

        {rows.length > 0 && (
          <div
            className={series.loading ? 'chart is-updating' : 'chart'}
            role="img"
            aria-label={`Line chart of actual wind generation and the forecast used, ${rows.length} hours.`}
          >
            <ResponsiveContainer width="100%" height={420}>
              <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  ticks={ticks}
                  tickFormatter={(t: number) => dayLabel(t)}
                  tick={{ fill: MUTED, fontSize: 11, fontFamily: MONO }}
                  tickLine={false}
                  axisLine={{ stroke: '#A39A8A' }}
                />
                <YAxis
                  width={64}
                  domain={[0, yTicks[yTicks.length - 1]]}
                  ticks={yTicks}
                  tickFormatter={(v: number) => (v === 0 ? '0 MW' : fmt(v))}
                  tick={{ fill: MUTED, fontSize: 11, fontFamily: MONO }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ stroke: MUTED, strokeDasharray: '3 3' }}
                  content={({ active, payload }) => (
                    <ForecastTooltip active={active} row={payload?.[0]?.payload as Row | undefined} />
                  )}
                />
                <Area dataKey="band" stroke="none" fill={ACCENT} fillOpacity={0.14} isAnimationActive={false} activeDot={false} />
                <Line dataKey="forecast" stroke={ACCENT} strokeWidth={1.6} dot={false} isAnimationActive={false} />
                <Line dataKey="actual" stroke={INK} strokeWidth={1.4} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <p className="page-note">
        {query.mode === 'decision'
          ? 'Decision view: for each hour, the newest Elexon forecast published before 11:00 UK time on the day before delivery, the one the desk had when the day-ahead auction closed.'
          : `Horizon view: for each hour, the newest forecast published at least ${query.horizon} hours before it. Move the slider to see how accuracy changes with lead time.`}
      </p>
    </>
  )
}

function ForecastTooltip({ active, row }: { active?: boolean; row?: Row }) {
  if (!active || !row) return null
  const p = row.point
  return (
    <div className="tooltip">
      <div className="tooltip-title">{dateTimeLabel(p.start_time)} UK</div>
      <dl className="tooltip-grid mono">
        <dt>Actual</dt><dd>{fmt(p.actual)} MW</dd>
        <dt>Forecast</dt><dd className="accent">{fmt(p.forecast)} MW</dd>
        <dt>Error</dt><dd>{signed(p.error)} MW</dd>
        {p.band_low !== null && p.band_high !== null && (
          <>
            <dt>Likely range</dt><dd>{fmt(Math.max(0, p.band_low))} to {fmt(p.band_high)}</dd>
          </>
        )}
      </dl>
      <div className="tooltip-foot">
        Published {dateTimeLabel(p.publish_time)}, {p.horizon_hours} h ahead.{' '}
        {p.error >= 0 ? 'Wind came in below forecast.' : 'Wind came in above forecast.'}
      </div>
    </div>
  )
}
