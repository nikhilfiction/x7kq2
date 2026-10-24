import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Mode, Query } from '../types'

export const DELIVERY_START = '2026-01-02'
export const DELIVERY_END = '2026-02-01'
export const MAX_HORIZON = 48
const DEFAULT_HORIZON = 6

function clampDate(value: string | null, fallback: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback
  if (value < DELIVERY_START) return DELIVERY_START
  if (value > DELIVERY_END) return DELIVERY_END
  return value
}

/**
 * The view controls (mode, horizon, date range) live in the URL query string,
 * e.g. /accuracy?mode=horizon&horizon=12. That way the Forecast and Accuracy
 * pages share them, the back button works, and a link reproduces the same view.
 */
export function useControls() {
  const [params, setParams] = useSearchParams()

  const mode: Mode = params.get('mode') === 'horizon' ? 'horizon' : 'decision'
  const rawHorizon = Number(params.get('horizon'))
  const horizon = Number.isFinite(rawHorizon) && params.has('horizon')
    ? Math.min(MAX_HORIZON, Math.max(0, Math.round(rawHorizon)))
    : DEFAULT_HORIZON
  let start = clampDate(params.get('start'), DELIVERY_START)
  let end = clampDate(params.get('end'), DELIVERY_END)
  if (start > end) [start, end] = [end, start]

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) next.set(key, value)
    setParams(next, { replace: true })
  }

  return {
    mode,
    horizon,
    start,
    end,
    setMode: (value: Mode) => update({ mode: value }),
    setHorizon: (value: number) => update({ horizon: String(value) }),
    setRange: (from: string, to: string) => update({ start: from, end: to }),
  }
}

/** Wait until `value` stops changing for `delay` ms (used for the slider). */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** The query sent to the API, with the horizon debounced. */
export function useQuery(): Query {
  const { mode, horizon, start, end } = useControls()
  const debouncedHorizon = useDebounced(horizon)
  return { mode, horizon: mode === 'horizon' ? debouncedHorizon : undefined, start, end }
}
