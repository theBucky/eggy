<script lang="ts">
	import IconLoader from '@tabler/icons-svelte/icons/loader';
	import { cn } from "$lib/utils.js";
	import type { ComponentProps } from "svelte";

	let { class: className, ...restProps }: ComponentProps<IconLoader> = $props();
</script>

<!-- Chromium can't composite an animation on an <svg>, so the wrapper spins instead. -->
<span class={cn("inline-flex size-4 shrink-0 animate-spin", className)}>
	<IconLoader role="status" aria-label="Loading" class="size-full" {...restProps} />
</span>
