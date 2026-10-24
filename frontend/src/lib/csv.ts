type Cell = string | number | null | undefined

function escape(cell: Cell): string {
  if (cell === null || cell === undefined) return ''
  const text = String(cell)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Build a CSV file in the browser and start a download. */
export function downloadCsv(filename: string, header: string[], rows: Cell[][]): void {
  const lines = [header, ...rows].map((row) => row.map(escape).join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
