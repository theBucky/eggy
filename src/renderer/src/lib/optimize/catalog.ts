import { OPTIMIZATIONS, type Optimization } from '$shared/optimize'

type Group = 'Applications' | 'Finder' | 'Network' | 'System'

export const CATALOG: Record<Optimization, { group: Group; name: string; description: string }> = {
  savedStates: {
    group: 'Applications',
    name: 'Saved states',
    description: 'Move window states saved over 30 days ago to the Trash.'
  },
  preferences: {
    group: 'Applications',
    name: 'Preferences',
    description: 'Move preference files that no longer parse to the Trash.'
  },
  appDatabases: {
    group: 'Applications',
    name: 'App databases',
    description: 'Compact the Safari and Messages databases.'
  },
  loginItems: {
    group: 'Applications',
    name: 'Login items',
    description: 'Find login items whose apps are gone.'
  },
  launchAgents: {
    group: 'Applications',
    name: 'Launch agents',
    description: 'Find launch agents whose programs are gone.'
  },
  quickLook: {
    group: 'Finder',
    name: 'QuickLook',
    description: 'Reset QuickLook thumbnails and previews.'
  },
  sharedFileLists: {
    group: 'Finder',
    name: 'Favorites and recents',
    description: 'Move broken sidebar favorites and recent items lists to the Trash.'
  },
  networkVolumes: {
    group: 'Finder',
    name: 'Network volumes',
    description: 'Stop Finder writing .DS_Store files to network and USB volumes.'
  },
  dnsCache: { group: 'Network', name: 'DNS cache', description: 'Refresh the DNS cache.' },
  networkStack: {
    group: 'Network',
    name: 'Network stack',
    description: 'Flush the routing table and ARP cache when the network is down.'
  },
  spotlight: {
    group: 'System',
    name: 'Spotlight',
    description: 'Rebuild the index when searches stall.'
  },
  notifications: {
    group: 'System',
    name: 'Notifications',
    description: 'Clear notifications older than 30 days once their database passes 50 MB.'
  },
  quarantine: {
    group: 'System',
    name: 'Quarantine history',
    description: "Clear Gatekeeper's record of past downloads."
  }
}

export const GROUPS = Map.groupBy(OPTIMIZATIONS, (optimization) => CATALOG[optimization].group)
