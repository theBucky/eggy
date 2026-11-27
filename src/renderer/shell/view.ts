export type Detail = { page: 'app' | 'package' | 'repo'; id: string }

export type View = { page: 'home' | 'optimize' | 'settings' } | Detail
