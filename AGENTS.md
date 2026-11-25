## commands

- `pnpm dev`: run Electron with HMR.
- `pnpm build`: typecheck (`tsc` for main/preload, `svelte-check` for the renderer) then build main/preload/renderer; `pnpm typecheck` runs checks alone.
- `pnpm dlx shadcn-svelte@latest add <component>`: vendor shadcn-svelte components into `src/renderer/src/lib/components/ui` (directory is excluded from lint and format).

## boundaries

- treat `refs/` as read-only reference material; do not edit or import from that directory.
- remove obsolete paths directly. do not add backward-compatibility layers, fallbacks, migrations, or mention the removal in docs unless requested.
- keep public pull requests, commits, generated files, and documentation free of private names, internal context, customer-derived data, and ai attribution.

## ui

- tight grids, crisp layouts, 2px design rule.
- top-level blocks: `mt-8`, including the first below the title. only a list of metadata about the title's subject gets `mt-6`.
- vertical scroll containers: `my-2` to clear rounded corners. reduce padding to preserve edge spacing.
- use shadcn-svelte first. write custom markup and styles only when no component fits.
- override primitive styles via `class` only on explicit request.
