type Kind = 'number' | 'string' | 'period' | 'separator' | 'dash'

function kindOf(part: string): Kind {
  if (part === '.') return 'period'

  if (part === '-') return 'dash'

  if (/^\p{Nd}/u.test(part)) return 'number'

  if (/^[\s\p{P}]/u.test(part)) return 'separator'

  return 'string'
}

function separates(kind: Kind): boolean {
  return kind === 'period' || kind === 'separator'
}

// A dash ends the version so a trailing commit hash never counts.
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
  for (let index = leadingNumbers(shorter); index < leadingNumbers(longer); index++) {
    shorter.splice(index, 0, kindOf(longer[index]) === 'period' ? '.' : '0')
  }
}

// Follows Sparkle's SUStandardVersionComparator rather than semver.
export function compare(a: string, b: string): number {
  const partsA = split(a)
  const partsB = split(b)

  pad(partsA, partsB)
  pad(partsB, partsA)

  const shared = Math.min(partsA.length, partsB.length)

  for (let index = 0; index < shared; index++) {
    const partA = partsA[index]
    const partB = partsB[index]
    const kindA = kindOf(partA)
    const kindB = kindOf(partB)

    if (kindA === kindB || (separates(kindA) && separates(kindB))) {
      if (kindA === 'number' && Number(partA) !== Number(partB)) {
        return Number(partA) > Number(partB) ? 1 : -1
      }

      if (kindA === 'string' && partA !== partB) return partA > partB ? 1 : -1
    } else if (kindB === 'string') {
      return 1
    } else {
      return kindA === 'number' ? 1 : -1
    }
  }

  if (partsA.length === partsB.length) return 0

  const longer = partsA.length > partsB.length ? partsA : partsB
  const newerIsLonger = kindOf(longer[shared]) !== 'string'

  return partsA.length > partsB.length === newerIsLonger ? 1 : -1
}
