import type { HorizonRow, MetricsResponse, Query, SeriesResponse } from './types'

// Empty by default: the app calls relative URLs (/api/...) which the Vite dev
// proxy or nginx forwards to the backend. On Vercel, set VITE_API_URL to the
// backend's address, e.g. https://my-backend.onrender.com
export const API_BASE: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function toParams(query: Partial<Query>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return params.toString()
}

async function getJson<T>(path: string, query: Partial<Query>, signal?: AbortSignal): Promise<T> {
  const qs = toParams(query)
  const response = await fetch(`${API_BASE}${path}${qs ? `?${qs}` : ''}`, { signal })

  if (!response.ok) {
    // FastAPI errors look like {"detail": "..."} or {"detail": [{msg: ...}]}.
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') message = body.detail
      else if (Array.isArray(body.detail) && body.detail[0]?.msg) message = body.detail[0].msg
    } catch {
      // Body was not JSON; keep the generic message.
    }
    throw new ApiError(response.status, message)
  }
  return response.json() as Promise<T>
}

export function getSeries(query: Query, signal?: AbortSignal) {
  return getJson<SeriesResponse>('/api/series', query, signal)
}

export function getMetrics(query: Query, signal?: AbortSignal) {
  return getJson<MetricsResponse>('/api/metrics', query, signal)
}

export function getMetricsByHorizon(query: Pick<Query, 'start' | 'end'>, signal?: AbortSignal) {
  return getJson<HorizonRow[]>('/api/metrics/by-horizon', query, signal)
}
