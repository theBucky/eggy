<script lang="ts">
	import { Separator } from "$primitives/ui/separator/index.js";
	import { cn } from "$primitives/utils.js";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: ComponentProps<typeof Separator> = $props();
</script>

<Separator
	bind:ref
	data-slot="item-separator"
	orientation="horizontal"
	class={cn("mx-2 data-horizontal:w-auto", className)}
	{...restProps}
/>
