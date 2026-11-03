# electron-app

Electron + Vite + Svelte 5 + TypeScript 6 + shadcn-svelte (preset `b3XotzQSQc`), linted with oxlint and formatted with oxfmt.

## Setup

```sh
pnpm install
```

## Develop

```sh
pnpm dev
```

## Scripts

| Command             | Description                                   |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Dev server + Electron with HMR                |
| `pnpm build`        | Typecheck and build all processes             |
| `pnpm typecheck`    | `svelte-check` on node + web tsconfigs        |
| `pnpm lint`         | oxlint                                        |
| `pnpm format`       | oxfmt (write)                                 |
| `pnpm format:check` | oxfmt (check only)                            |
| `pnpm build:mac`    | Package with electron-builder (macOS)         |

## shadcn-svelte

Add components with:

```sh
pnpm dlx shadcn-svelte@latest add <component>
```

Config lives in `components.json`; components land in `src/renderer/src/lib/components/ui`.
