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

export function ago(date: number): string {
  tick()

  // A committer clock running ahead would otherwise read as a future time.
  const elapsed = Math.max(Date.now() - date, 0)
  const [unit, size] = units.find(([, size]) => elapsed >= size) ?? units[units.length - 1]

  return relative.format(-Math.floor(elapsed / size), unit)
}
