import { DELIVERY_END, DELIVERY_START, MAX_HORIZON, useControls } from '../hooks/useControls'

export default function ControlBar() {
  const { mode, horizon, start, end, setMode, setHorizon, setRange } = useControls()
  const isHorizon = mode === 'horizon'

  return (
    <section aria-label="View controls" className="controls">
      <div className="controls-group">
        <div className="field">
          <label htmlFor="start" className="field-label">From</label>
          <input
            id="start"
            type="date"
            className="input mono"
            min={DELIVERY_START}
            max={end}
            value={start}
            onChange={(e) => e.target.value && setRange(e.target.value, end)}
          />
          <label htmlFor="end" className="field-label">to</label>
          <input
            id="end"
            type="date"
            className="input mono"
            min={start}
            max={DELIVERY_END}
            value={end}
            onChange={(e) => e.target.value && setRange(start, e.target.value)}
          />
        </div>

        <div role="group" aria-label="View" className="segmented">
          <button type="button" aria-pressed={!isHorizon} onClick={() => setMode('decision')}>
            Decision view
          </button>
          <button type="button" aria-pressed={isHorizon} onClick={() => setMode('horizon')}>
            Horizon view
          </button>
        </div>

        <div className={isHorizon ? 'field' : 'field is-off'}>
          <label htmlFor="horizon" className="field-label">Hours ahead</label>
          <input
            id="horizon"
            type="range"
            className="slider"
            min={0}
            max={MAX_HORIZON}
            step={1}
            value={horizon}
            disabled={!isHorizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
          />
          <span className="mono slider-value">{horizon} h</span>
        </div>
      </div>
      <div className="controls-meta mono">
        <span>Zone: <strong>Europe/London</strong></span>
        <span>Cutoff: <strong>11:00 UK, day before delivery</strong></span>
      </div>
    </section>
  )
}
