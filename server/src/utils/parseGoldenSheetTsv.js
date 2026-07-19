function parseTsvLine(line) {
  const cols = line.split('\t')
  return cols.map((col) => col.replace(/\r$/, '').trim())
}

function parseGoldenSheetTsv(content) {
  const lines = String(content || '')
    .replace(/\uFEFF/g, '')
    .split(/\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)

  if (lines.length < 2) return []

  const headers = parseTsvLine(lines[0])
  const rows = []

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseTsvLine(lines[i])
    const row = {}
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? ''
    })
    rows.push(row)
  }

  return rows
}

module.exports = {
  parseGoldenSheetTsv,
}
