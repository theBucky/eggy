<script lang="ts">
	import IconLoader2 from '@tabler/icons-svelte/icons/loader-2';
	import { cn } from "$lib/utils.js";
	import type { ComponentProps } from "svelte";

	let { class: className, ...restProps }: ComponentProps<IconLoader2> = $props();
</script>

<!-- Chromium can't composite an animation on an <svg>, so the wrapper spins instead. -->
<span class={cn("inline-flex size-4 shrink-0 animate-[spin_1s_cubic-bezier(0.5,0.15,0.5,0.85)_infinite]", className)}>
	<IconLoader2 role="status" aria-label="Loading" class="size-full" {...restProps} />
</span>
