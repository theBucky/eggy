<script lang="ts">
  import { Button } from '$lib/components/ui/button'

  const versions = window.electron.process.versions
  let count = $state(0)
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4">
  <h1 class="text-2xl font-semibold tracking-tight">Electron + Vite + shadcn-svelte</h1>
  <p class="text-sm text-muted-foreground">
    Electron {versions.electron} · Chromium {versions.chrome} · Node {versions.node}
  </p>
  <div class="flex gap-2">
    <Button onclick={() => (count += 1)}>Count is {count}</Button>
    <Button variant="outline" onclick={() => window.electron.ipcRenderer.send('ping')}>
      Send IPC
    </Button>
  </div>
</div>
