import { createSubscriber } from 'svelte/reactivity'

const relative = new Intl.RelativeTimeFormat('en')

const units = [
  ['year', 365 * 86_400_000],
  ['month', 30 * 86_400_000],
  ['week', 7 * 86_400_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
  ['second', 1000]
] as const

const tick = createSubscriber((update) => {
  const timer = setInterval(update, 60_000)

  return () => clearInterval(timer)
})

function largest(span: number): (typeof units)[number] {
  return units.find(([, size]) => span >= size) ?? units[units.length - 1]
}

export function ago(date: number): string {
  tick()

  // A committer clock running ahead would otherwise read as a future time.
  const elapsed = Math.max(Date.now() - date, 0)
  const [unit, size] = largest(elapsed)

  return relative.format(-Math.floor(elapsed / size), unit)
}

export function duration(span: number): string {
  const [unit, size] = largest(span)
  const format = new Intl.NumberFormat('en', { style: 'unit', unit, unitDisplay: 'long' })

  return format.format(Math.floor(span / size))
}
