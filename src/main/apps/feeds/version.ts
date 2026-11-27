type Kind = 'number' | 'string' | 'period' | 'separator' | 'dash'

function kindOf(part: string): Kind {
  if (part === '.') return 'period'

  if (part === '-') return 'dash'

  if (/^\d/.test(part)) return 'number'

  if (/^[\s\p{P}]/u.test(part)) return 'separator'

  return 'string'
}

function separates(kind: Kind): boolean {
  return kind === 'period' || kind === 'separator'
}

function split(version: string): string[] {
  const parts: string[] = []

  for (const char of version) {
    const kind = kindOf(char)
    const last = parts.at(-1)

    if (last !== undefined && kind === 'dash') break

    if (last === undefined || kind !== kindOf(last) || separates(kindOf(last))) parts.push(char)
    else parts[parts.length - 1] = last + char
  }

  return parts
}

function leadingNumbers(parts: string[]): number {
  const end = parts.findIndex((part) => kindOf(part) !== 'number' && kindOf(part) !== 'period')

  return end === -1 ? parts.length : end
}

function pad(shorter: string[], longer: string[]): void {
  const start = leadingNumbers(shorter)
  const missing = longer.slice(start, leadingNumbers(longer))

  shorter.splice(start, 0, ...missing.map((part) => (kindOf(part) === 'period' ? '.' : '0')))
}

// Follows Sparkle's SUStandardVersionComparator rather than semver.
export function compare(a: string, b: string): number {
  const partsA = split(a)
  const partsB = split(b)

  pad(partsA, partsB)
  pad(partsB, partsA)

  for (const [index, partA] of partsA.entries()) {
    const partB = partsB[index]
    const kindA = kindOf(partA)

    if (partB === undefined) return kindA === 'string' ? -1 : 1

    const kindB = kindOf(partB)

    if (kindA === kindB || (separates(kindA) && separates(kindB))) {
      if (kindA === 'number' && BigInt(partA) !== BigInt(partB)) {
        return BigInt(partA) > BigInt(partB) ? 1 : -1
      }

      if (kindA === 'string' && partA !== partB) return partA > partB ? 1 : -1
    } else if (kindB === 'string') {
      return 1
    } else {
      return kindA === 'number' ? 1 : -1
    }
  }

  const extra = partsB[partsA.length]

  if (extra === undefined) return 0

  return kindOf(extra) === 'string' ? 1 : -1
}
