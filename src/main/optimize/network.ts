import type { OptimizeOutcome } from '$shared/api'
import { command, guarded, quote, stoppedBy, type Guard, type Plan } from './root'
import { exec, output } from './support'

// Refreshing network state makes a connected VPN drop and reconnect. A VPN shows up either as a
// connected network service or, for tunnels such as wg-quick that bypass network services, as a
// tunnel interface with a routable address. macOS keeps its own tunnels up with link-local
// addresses alone.
const NO_VPN: Guard = {
  check: `services=$(/usr/sbin/scutil --nc list) || exit 2
if printf '%s\\n' "$services" | /usr/bin/grep -q '^\\* (Connected)'; then exit 1; fi
interfaces=$(/sbin/ifconfig) || exit 2
printf '%s\\n' "$interfaces" | /usr/bin/awk '
  /^[^ \\t]/ { tunnel = $1 ~ /^(utun|ipsec|ppp)[0-9]+:$/ }
  tunnel && ($1 == "inet" || ($1 == "inet6" && $2 !~ /^fe80:/)) { exit 1 }
'`,
  stopped: { status: 'skipped', message: 'Skipped while a VPN is connected.' }
}

// The label is the one service the script signals, so an unexpected one stops it before any change.
const LABELS = ['com.apple.mDNSResponder', 'com.apple.mDNSResponder.reloaded']

// macOS 27 refuses `launchctl kill` on mDNSResponder even for root. Its own service account may still
// signal the processes it owns, and `-u` keeps a same-named process of another user out of reach.
const NOT_PRIVILEGED = 'Not privileged to signal service'
const REFUSED = 75

export async function dnsCache(): Promise<OptimizeOutcome | Plan> {
  const stopped = await stoppedBy(NO_VPN)

  if (stopped !== undefined) return stopped

  const label = (
    await output(
      '/usr/bin/plutil',
      [
        '-extract',
        'Label',
        'raw',
        '-o',
        '-',
        '/System/Library/LaunchDaemons/com.apple.mDNSResponder.plist'
      ],
      5000
    )
  ).trim()

  if (!LABELS.includes(label)) {
    throw new Error(`mDNSResponder runs under an unexpected label, ${label}.`)
  }

  const script = `${command('/usr/bin/dscacheutil', '-flushcache')} || exit
refusal=$(${command('/bin/launchctl', 'kill', 'SIGHUP', `system/${label}`)} 2>&1) && exit 0
case $refusal in
  *${quote(NOT_PRIVILEGED)}*)
    ${command('/usr/bin/sudo', '-u', '_mdnsresponder', '/usr/bin/killall', '-u', '_mdnsresponder', '-HUP', 'mDNSResponder')} || exit ${REFUSED} ;;
  *) printf '%s\\n' "$refusal"; exit 1 ;;
esac`

  return guarded(NO_VPN, {
    script,
    interpret: ({ code, output }) => {
      if (code === 0) return { status: 'applied', message: 'Refreshed the DNS cache.' }

      if (code === REFUSED) {
        return { status: 'skipped', message: "macOS doesn't allow refreshing mDNSResponder." }
      }

      return { status: 'failed', message: output || "Couldn't refresh the DNS cache." }
    }
  })
}

// A default route in either address family and a working lookup mean there's nothing to repair, and
// flushing would only drop every route until the system rebuilds them. `route get` exits with 0 even
// when it finds no route.
async function healthy(): Promise<boolean> {
  const probes = await Promise.all([
    exec('/sbin/route', ['-n', 'get', '-inet', 'default'], 3000),
    exec('/sbin/route', ['-n', 'get', '-inet6', 'default'], 3000),
    exec('/usr/bin/dscacheutil', ['-q', 'host', '-a', 'name', 'example.com'], 3000)
  ])

  if (probes.some(({ timedOut }) => timedOut)) {
    throw new Error('The network took too long to answer.')
  }

  const [inet, inet6, lookup] = probes

  return (
    [inet, inet6].some(({ stdout }) => /^ *interface: /m.test(stdout)) &&
    /^ip(v6)?_address: /m.test(lookup.stdout)
  )
}

export async function networkStack(): Promise<OptimizeOutcome | Plan> {
  const stopped = await stoppedBy(NO_VPN)

  if (stopped !== undefined) return stopped

  if (await healthy()) return { status: 'unchanged', message: 'The network is healthy.' }

  return guarded(NO_VPN, {
    script: `${command('/sbin/route', '-n', 'flush')} >/dev/null && ${command('/usr/sbin/arp', '-a', '-d')} >/dev/null`,
    interpret: ({ code, output }) =>
      code === 0
        ? { status: 'applied', message: 'Flushed the routing table and ARP cache.' }
        : { status: 'failed', message: output || "Couldn't flush the routing table." }
  })
}
