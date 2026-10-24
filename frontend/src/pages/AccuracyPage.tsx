import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getMetrics, getMetricsByHorizon, getSeries } from '../api'
import ControlBar from '../components/ControlBar'
import Status from '../components/Status'
import { useApi } from '../hooks/useApi'
import { useQuery } from '../hooks/useControls'
import { downloadCsv } from '../lib/csv'
import { dateTimeLabel, fmt, isoDayLabel, kLabel, pad2, pct, signed } from '../lib/format'
import type { DayRow } from '../types'

const INK = '#17140F'
const INK_SOFT = '#3A342B'
const STONE = '#8C8272'
const ACCENT = '#B4380A'
const GRID = '#DDD6C9'
const MUTED = '#6A6255'
const MONO = "'IBM Plex Mono', ui-monospace, monospace"
const AXIS_TICK = { fill: MUTED, fontSize: 10, fontFamily: MONO }
const PAGE_SIZE = 14

export default function AccuracyPage() {
  const query = useQuery()
  const deps = [query.mode, query.horizon, query.start, query.end]
  const metrics = useApi((signal) => getMetrics(query, signal), deps)
  const series = useApi((signal) => getSeries(query, signal), deps)
  const byHorizon = useApi(
    (signal) => getMetricsByHorizon({ start: query.start, end: query.end }, signal),
    [query.start, query.end],
  )

  const summary = metrics.data?.summary
  const points = series.data?.points ?? []

  // Worst single hour, and the average lead time of the forecasts in use.
  const { worst, averageLead } = useMemo(() => {
    let worstPoint = points[0]
    let leadSum = 0
    for (const p of points) {
      if (Math.abs(p.error) > Math.abs(worstPoint.error)) worstPoint = p
      leadSum += p.horizon_hours
    }
    return { worst: worstPoint, averageLead: points.length ? leadSum / points.length : null }
  }, [points])

  const leadRows = byHorizon.data ?? []
  const pin = query.mode === 'horizon' ? query.horizon ?? 0 : Math.round(averageLead ?? 26)
  const pinned = leadRows.find((r) => r.horizon_hours === pin)
  const meanActual = summary?.mean_actual ?? null

  // Hour-of-day bars: highlight the worst hour and hours above average.
  const hours = metrics.data?.by_hour ?? []
  const hourMaes = hours.map((h) => h.mae ?? 0)
  const hourAvg = hourMaes.reduce((a, b) => a + b, 0) / (hourMaes.length || 1)
  const peak = hours.reduce<(typeof hours)[number] | null>((best, h) => (!best || (h.mae ?? 0) > (best.mae ?? 0) ? h : best), null)

  const bins = (metrics.data?.distribution ?? []).map((b) => ({ ...b, label: kLabel(b.from) }))

  return (
    <>
      <ControlBar />
      <Status loading={metrics.loading} error={metrics.error} hasData={!!metrics.data} />

      <section aria-label="Key figures" className="figures panel">
        <div className="figure">
          <span className="figure-label">Mean absolute error (MAE)</span>
          <span className="figure-value">{fmt(summary?.mae)} <small>MW</small></span>
          <span className="figure-note">{pct(summary?.nmae_pct)} of average wind output</span>
        </div>
        <div className="figure">
          <span className="figure-label">Root mean square error (RMSE)</span>
          <span className="figure-value">{fmt(summary?.rmse)} <small>MW</small></span>
          <span className="figure-note">
            {summary?.rmse && summary?.mae ? `${(summary.rmse / summary.mae).toFixed(2)}x the MAE: big misses push this up` : ' '}
          </span>
        </div>
        <div className="figure">
          <span className="figure-label">Bias</span>
          <span className="figure-value accent">{signed(summary?.bias)} <small>MW</small></span>
          <span className="figure-note">
            {summary?.bias == null ? ' ' : summary.bias >= 0 ? 'Forecast ran high: less wind than expected' : 'Forecast ran low: more wind than expected'}
          </span>
        </div>
        <div className="figure">
          <span className="figure-label">Worst single hour</span>
          <span className="figure-value">{signed(worst?.error)} <small>MW</small></span>
          <span className="figure-note">{worst ? `${dateTimeLabel(worst.start_time)} UK` : ' '}</span>
        </div>
      </section>

      <div className="split">
        <section className="panel split-main">
          <div className="panel-head">
            <div>
              <h2>Error vs forecast lead time</h2>
              <p className="muted small">MAE and RMSE for forecasts made 0 to 48 hours before the hour they describe</p>
            </div>
            <div className="legend legend-box mono">
              <span><i className="swatch-line" style={{ background: ACCENT }} />MAE (MW)</span>
              <span className="muted"><i className="swatch-dash" />RMSE (MW)</span>
            </div>
          </div>

          <Status loading={byHorizon.loading} error={byHorizon.error} hasData={leadRows.length > 0} />
          {leadRows.length > 0 && (
            <div className="chart chart-lead" role="img" aria-label={`MAE rises from ${fmt(leadRows[0]?.mae)} MW at 0 hours ahead to ${fmt(leadRows[leadRows.length - 1]?.mae)} MW at 48 hours ahead.`}>
              {pinned && (
                <div className="callout mono">
                  <strong>{query.mode === 'horizon' ? `Horizon: ${pin} h ahead` : `Decision view, about ${pin} h`}</strong>
                  <span className="callout-mae">
                    MAE {fmt(pinned.mae)} MW
                    {meanActual && pinned.mae ? <em> ({pct((pinned.mae / meanActual) * 100)})</em> : null}
                  </span>
                  <span>RMSE {fmt(pinned.rmse)} MW</span>
                </div>
              )}
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={leadRows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                  <ReferenceArea x1={14.5} x2={37.5} fill={INK} fillOpacity={0.04} ifOverflow="extendDomain" />
                  <XAxis
                    dataKey="horizon_hours"
                    type="number"
                    domain={[0, 48]}
                    ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48]}
                    tickFormatter={(h: number) => `${h}h`}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={{ stroke: '#A39A8A' }}
                  />
                  <YAxis width={52} tickFormatter={(v: number) => fmt(v)} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="tooltip mono">
                          <div className="tooltip-title">{label} h ahead</div>
                          <dl className="tooltip-grid">
                            <dt>MAE</dt><dd className="accent">{fmt(payload.find((p) => p.dataKey === 'mae')?.value as number)} MW</dd>
                            <dt>RMSE</dt><dd>{fmt(payload.find((p) => p.dataKey === 'rmse')?.value as number)} MW</dd>
                          </dl>
                        </div>
                      ) : null
                    }
                  />
                  <ReferenceLine x={pin} stroke={ACCENT} strokeDasharray="4 3" />
                  <Line dataKey="rmse" stroke={MUTED} strokeWidth={1.6} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
                  <Line dataKey="mae" stroke={ACCENT} strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="panel-foot mono">
            <span>Hourly forecasts compared with hourly actuals (n = {fmt(summary?.count)})</span>
            <span>Shaded: lead times used in Decision view (14 to 38 h)</span>
          </div>
        </section>

        <div className="split-side">
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Error by hour of day</h3>
                <p className="muted small">MAE for each delivery hour, UK time</p>
              </div>
              {peak && <span className="chip mono">Peak: {pad2(peak.hour)}:00 ({fmt(peak.mae)} MW)</span>}
            </div>
            {hours.length > 0 && (
              <div className="chart" role="img" aria-label={peak ? `Bar chart of MAE by hour. Largest at ${pad2(peak.hour)}:00 with ${fmt(peak.mae)} MW.` : 'Bar chart of MAE by hour'}>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={hours} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
                    <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="hour" tickFormatter={(h: number) => pad2(h)} interval={3} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#A39A8A' }} />
                    <YAxis width={36} tickFormatter={(v: number) => kLabel(v).replace('+', '')} tick={AXIS_TICK} tickLine={false} axisLine={false} tickCount={3} />
                    <Tooltip
                      cursor={{ fill: 'rgba(23,20,15,0.05)' }}
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="tooltip mono">
                            {pad2(payload[0].payload.hour)}:00 &middot; MAE {fmt(payload[0].payload.mae)} MW
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="mae" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                      {hours.map((h) => (
                        <Cell key={h.hour} fill={h.hour === peak?.hour ? ACCENT : (h.mae ?? 0) > hourAvg ? INK_SOFT : STONE} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Distribution of forecast error</h3>
                <p className="muted small">1,000 MW buckets. Bias {signed(summary?.bias)} MW.</p>
              </div>
              <span className="chip mono">{fmt(summary?.count)} hours</span>
            </div>
            {bins.length > 0 && (
              <div className="chart" role="img" aria-label="Histogram of forecast errors in 1,000 MW buckets.">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={bins} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={3}>
                    <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#A39A8A' }} interval="preserveStartEnd" />
                    <YAxis width={36} tick={AXIS_TICK} tickLine={false} axisLine={false} tickCount={3} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(23,20,15,0.05)' }}
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="tooltip mono">
                            {signed(payload[0].payload.from)} to {signed(payload[0].payload.to)} MW &middot; {payload[0].payload.count} hours
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                      {bins.map((b) => (
                        <Cell key={b.from} fill={b.from <= 0 && b.to >= 0 ? ACCENT : INK_SOFT} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="muted small">Left of zero: more wind than forecast. Right of zero: less wind than forecast, so the desk was short.</p>
          </section>
        </div>
      </div>

      <DailyTable days={metrics.data?.by_day ?? []} mode={query.mode} />
    </>
  )
}

function DailyTable({ days, mode }: { days: DayRow[]; mode: string }) {
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(0)

  const worstDate = days.reduce<DayRow | null>((best, d) => (!best || (d.mae ?? 0) > (best.mae ?? 0) ? d : best), null)?.date
  const labelled = days.map((d) => ({ ...d, label: isoDayLabel(d.date) }))
  const q = filter.trim().toLowerCase()
  const filtered = labelled.filter((d) => !q || d.label.toLowerCase().includes(q) || d.date.includes(q))
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  function exportCsv() {
    downloadCsv(
      `daily-accuracy-${mode}.csv`,
      ['date', 'mean_actual_mw', 'mean_forecast_mw', 'mae_mw', 'bias_mw', 'worst_hour_abs_error_mw', 'hours'],
      filtered.map((d) => [d.date, d.mean_actual, d.mean_forecast, d.mae, d.bias, d.max_abs_error, d.count]),
    )
  }

  return (
    <section className="panel">
      <div className="panel-head table-head">
        <div className="table-title">
          <h2>Daily accuracy</h2>
          <span className="muted mono small">{days.length} delivery days</span>
        </div>
        <div className="table-tools">
          <label htmlFor="dayFilter" className="visually-hidden">Filter by day</label>
          <input
            id="dayFilter"
            type="search"
            className="input mono"
            placeholder="Filter, e.g. 18 Jan"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setPage(0)
            }}
          />
          <button type="button" className="button" onClick={exportCsv} disabled={filtered.length === 0}>
            Download CSV
          </button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Delivery day</th>
              <th scope="col" className="num">Mean actual (MW)</th>
              <th scope="col" className="num">Mean forecast (MW)</th>
              <th scope="col" className="num">MAE (MW)</th>
              <th scope="col" className="num">Bias (MW)</th>
              <th scope="col" className="num">Worst hour (MW)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.date} className={d.date === worstDate ? 'is-worst' : undefined}>
                <td>{d.label}</td>
                <td className="num">{fmt(d.mean_actual)}</td>
                <td className="num">{fmt(d.mean_forecast)}</td>
                <td className="num">{fmt(d.mae)}</td>
                <td className={(d.bias ?? 0) >= 0 ? 'num accent' : 'num'}>{signed(d.bias)}</td>
                <td className="num muted">{fmt(d.max_abs_error)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="notice">No delivery day matches that filter.</p>}
      </div>

      <div className="panel-foot mono">
        <span>Showing {rows.length} of {filtered.length} days. Highlighted: worst day by MAE.</span>
        <div className="pager">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              className="button"
              aria-current={i === current ? 'page' : undefined}
              onClick={() => setPage(i)}
            >
              {i + 1}
            </button>
          ))}
          <button type="button" className="button" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>
            Next
          </button>
        </div>
      </div>
    </section>
  )
}
