import type { BadgeVariant } from '$lib/components/ui/badge'

export type Status = 'unknown' | 'running' | 'failed' | 'outdated' | 'current'

export type StatusBadge = { label: string; variant: BadgeVariant }
