import type { ReactNode } from 'react'
import { API_BASE } from '../api'

const SECTIONS = [
  { id: 'data-sources', label: '01. Data sources', hint: 'BMRS' },
  { id: 'forecast-selection', label: '02. Which forecast is used', hint: 'D-1 11:00' },
  { id: 'accuracy-metrics', label: '03. How accuracy is measured', hint: 'MAE, RMSE' },
  { id: 'assumptions', label: '04. Assumptions', hint: '6 rules' },
]

const ASSUMPTIONS = [
  ['The cutoff is 11:00 UK time on the day before delivery', 'This matches the usual close of the GB day-ahead auction. If the desk works to a different deadline, Decision view should use that time instead.'],
  ['Only on-the-hour slots are compared', 'Forecasts are hourly, so the :30 actuals are left out rather than estimated.'],
  ['Forecasts for hours that had already started are dropped', 'Some runs include values for times before they were published. Those are not forecasts and are ignored.'],
  ['Missing hours are left out, not filled in', 'If an hour has no actual, or no forecast was published in time, it is skipped. The hour count on each screen shows how many were compared.'],
  ['Actuals are what was produced, not what could have been', 'When wind farms are told to reduce output, FUELHH records the lower figure. On those days the forecast can look too high even if the weather was forecast well.'],
  ['The likely range is measured on the same month it is drawn on', 'With one month of data this is the honest option. In regular use, the range would be calculated from earlier months and applied to new forecasts.'],
]

export default function MethodPage() {
  return (
    <>
      <section className="doc-hero">
        <div className="doc-hero-text">
          <span className="mono muted small">Method</span>
          <h1>How the forecasts are checked</h1>
          <p>
            Where the numbers come from, which forecast counts for each hour, how accuracy is measured, and the
            assumptions behind it. Everything on the Forecast and Accuracy screens follows these rules.
          </p>
        </div>
        <div className="doc-hero-actions">
          <button type="button" className="button" onClick={() => window.print()}>Print or save PDF</button>
          <a className="button button-accent" href={`${API_BASE}/docs`} target="_blank" rel="noreferrer">API docs</a>
        </div>
      </section>

      <div className="doc">
        <aside className="doc-aside">
          <nav aria-label="Sections" className="panel doc-index">
            <span className="mono muted small">Sections</span>
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                <span>{s.label}</span>
                <span className="mono muted small">{s.hint}</span>
              </a>
            ))}
          </nav>
          <div className="doc-glance mono">
            <span className="muted small">At a glance</span>
            <div><span className="muted">Delivery days</span><span>2 Jan to 1 Feb 2026</span></div>
            <div><span className="muted">Decision cutoff</span><span>11:00 UK, D-1</span></div>
            <div><span className="muted">Horizon range</span><span>0 to 48 h</span></div>
            <div><span className="muted">Resolution</span><span>Hourly</span></div>
          </div>
        </aside>

        <div className="doc-body">
          <section id="data-sources" className="panel doc-section">
            <SectionHead number="01" title="Data sources" note="Elexon BMRS, public API" />
            <p className="lead">
              Both datasets come from Elexon's Balancing Mechanism Reporting Service (BMRS), the public record of the
              GB electricity market. They are downloaded once, stored in a local database, and served by the app's own
              API, so the screens never depend on Elexon being reachable.
            </p>
            <div className="doc-grid">
              <div className="block">
                <div className="block-head mono"><strong>FUELHH: actual generation</strong><span className="muted">Every 30 min</span></div>
                <p>Average output in MW for each half hour, split by fuel type. Only rows where the fuel type is wind are used.</p>
                <pre className="code">fuelType = "WIND"{'\n'}startTime, generation</pre>
              </div>
              <div className="block">
                <div className="block-head mono"><strong>WINDFOR: wind forecast</strong><span className="muted">Hourly values</span></div>
                <p>National wind forecasts. A new forecast run is published several times a day, and each run covers roughly the next two to three days, so every hour is forecast many times.</p>
                <pre className="code">publishTime (when the run was made){'\n'}startTime, generation</pre>
              </div>
            </div>
            <div className="block">
              <h3>Half hours and hours</h3>
              <p>
                The GB market settles in 48 half-hour periods a day, which is why actuals are half-hourly. Forecasts are
                hourly, so the app compares the two only at the start of each hour. The half-hour actuals in between are
                not used in accuracy figures.
              </p>
            </div>
          </section>

          <section id="forecast-selection" className="panel doc-section">
            <SectionHead number="02" title="Which forecast is used" note="Timing and cutoffs" />
            <p className="lead">
              Judging the desk on a forecast published an hour before delivery would flatter the numbers, because that
              forecast did not exist when power was bought. So for every hour, the app picks one forecast run by one of
              two rules.
            </p>
            <div className="block">
              <h3>Decision view <span className="mono small accent">Default</span></h3>
              <p>
                The newest forecast published at or before <strong>11:00 UK time on the day before delivery</strong>.
                That is roughly when orders for the GB day-ahead auction close, so it is the forecast the desk actually
                had in hand when it decided how much power to buy. In practice these forecasts are 14 to 38 hours old by
                the time the hour arrives.
              </p>
            </div>
            <div className="block">
              <h3>Horizon view <span className="mono small muted">Slider, 0 to 48 h</span></h3>
              <p>
                The newest forecast published at least N hours before the hour it describes. Moving the slider shows how
                much accuracy improves as delivery gets closer, which tells the desk how much there is to gain from
                adjusting in the intraday market.
              </p>
            </div>
            <div className="block">
              <span className="mono muted small">Example: buying for Tuesday 18:00</span>
              <ol className="timeline">
                <li>
                  <span className="mono muted small">Monday, through the morning</span>
                  <strong>Forecast runs arrive</strong>
                  <span>Runs published at 02:30, 04:30, 07:30 and 09:30 all describe Tuesday 18:00.</span>
                </li>
                <li className="timeline-key">
                  <span className="mono small">Monday 11:00 UK</span>
                  <strong>Day-ahead cutoff</strong>
                  <span>The 09:30 run is the newest one. Decision view uses it. Later runs are ignored.</span>
                </li>
                <li>
                  <span className="mono muted small">Tuesday 18:00</span>
                  <strong>Delivery</strong>
                  <span>FUELHH records what wind actually produced. The difference is the error for that hour.</span>
                </li>
              </ol>
            </div>
          </section>

          <section id="accuracy-metrics" className="panel doc-section">
            <SectionHead number="03" title="How accuracy is measured" note="Formulas" />
            <p className="lead">For each hour, error = forecast minus actual. Every number on the Accuracy screen is built from that one column.</p>
            <div className="doc-grid">
              <Metric title="Mean absolute error (MAE)" formula="MAE = average of |forecast − actual|">
                The average size of a miss in MW, ignoring direction. The simplest answer to "how far off is it usually?"
              </Metric>
              <Metric title="Root mean square error (RMSE)" formula="RMSE = √(average of (forecast − actual)²)">
                Squares each miss before averaging, so a few large misses count for much more. RMSE well above MAE means
                occasional big surprises.
              </Metric>
              <Metric title="Bias" formula="Bias = average of (forecast − actual)">
                The average error keeping its sign. Positive means the forecast tends to promise more wind than arrives,
                leaving the desk short.
              </Metric>
              <Metric title="Likely range (P10 to P90)" formula="range = [forecast − P90, forecast − P10]">
                Taken from the spread of past errors in the selected period: 8 in 10 hours had an error between P10 and
                P90. The shaded band on the Forecast chart is the forecast shifted by those two values.
              </Metric>
            </div>
            <div className="block">
              <span className="mono muted small">Conventions</span>
              <div className="conventions">
                <div><span className="mono accent">n</span>Hours compared in the selected period: 744 for the full month, 24 for one day.</div>
                <div><span className="mono accent">Sign</span>Positive: forecast above actual, less wind than expected. Negative: more wind than expected.</div>
                <div><span className="mono accent">Percentages</span>MAE as a share of average actual output. Percentage error ignores hours under 1,000 MW, where dividing by a tiny actual gives misleading results.</div>
              </div>
            </div>
          </section>

          <section id="assumptions" className="panel doc-section">
            <SectionHead number="04" title="Assumptions" note="What to keep in mind" />
            <p className="lead">These choices shape the results. Each one is a single setting in the code and can be changed.</p>
            <ol className="assumptions">
              {ASSUMPTIONS.map(([title, body], i) => (
                <li key={title} className="block">
                  <span className="mono accent">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="muted small">
              All times are UK time. In January that is the same as GMT. The code works in UK local time, so the 11:00
              cutoff stays correct after the clocks change.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}

function SectionHead({ number, title, note }: { number: string; title: string; note: string }) {
  return (
    <div className="doc-section-head">
      <div>
        <span className="mono accent">{number}</span>
        <h2>{title}</h2>
      </div>
      <span className="mono muted small">{note}</span>
    </div>
  )
}

function Metric({ title, formula, children }: { title: string; formula: string; children: ReactNode }) {
  return (
    <div className="block block-metric">
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
      <code className="code">{formula}</code>
    </div>
  )
}
