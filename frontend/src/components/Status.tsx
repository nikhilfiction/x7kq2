interface Props {
  loading: boolean
  error: Error | null
  hasData: boolean
}

/** Plain-text loading and error messages (no spinners or skeletons). */
export default function Status({ loading, error, hasData }: Props) {
  if (error) {
    return (
      <div role="alert" className="notice notice-error">
        <strong>Could not load the data.</strong> {error.message}. Check that the backend is running and
        that <code>python scripts/ingest.py</code> has been run.
      </div>
    )
  }
  if (loading && !hasData) {
    return <p className="notice" aria-live="polite">Loading data…</p>
  }
  return null
}
