import { useEffect, useState } from 'react'

interface ApiState<T> {
  data: T | null
  error: Error | null
  loading: boolean
}

/**
 * Run an async request whenever `deps` change.
 * - Cancels the previous request if a new one starts (no out-of-order results).
 * - Keeps the last good data on screen while the next request loads,
 *   so charts don't flash empty when the slider moves.
 */
export function useApi<T>(request: (signal: AbortSignal) => Promise<T>, deps: unknown[]): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: true })

  useEffect(() => {
    const controller = new AbortController()
    setState((prev) => ({ ...prev, loading: true, error: null }))

    request(controller.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error : new Error(String(error)),
          loading: false,
        }))
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
