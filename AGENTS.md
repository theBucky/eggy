## commands

- `pnpm dev`: run Electron with HMR.
- `pnpm build`: typecheck (`svelte-check`) then build main/preload/renderer; `pnpm typecheck` runs checks alone.
- `pnpm dlx shadcn-svelte@latest add <component>`: vendor shadcn-svelte components into `src/renderer/src/lib/components/ui` (directory is excluded from lint and format).

## boundaries

- treat `refs/` as read-only reference material; do not edit or import from that directory.
- remove obsolete paths directly. do not add backward-compatibility layers, fallbacks, migrations, or mention the removal in docs unless requested.
- keep public pull requests, commits, generated files, and documentation free of private names, internal context, customer-derived data, and ai attribution.

## UI

- apply tight grids, crisp layouts with the 4px design rule.
- space a page's top-level blocks `mt-8` apart, including the first block under the title; only a metadata list that describes the title's subject sits closer, at `mt-6`.
- give every container that may scroll vertically a small vertical margin (`my-2`) so the scrollbar never gets clipped by rounded corners; keep total edge spacing by trading off padding.
- build ui with shadcn-svelte components first; hand-roll markup and styles only as a last resort when no component fits.
- never override shadcn-svelte primitives' styling with `class` unless explicitly requested.
