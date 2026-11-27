<script lang="ts">
	import { Separator } from "$primitives/ui/separator/index.js";
	import { cn } from "$primitives/utils.js";
	import type { Separator as SeparatorPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: SeparatorPrimitive.RootProps = $props();
</script>

<Separator
	bind:ref
	data-slot="select-separator"
	class={cn("bg-border mx-2 my-1.5 h-px pointer-events-none", className)}
	{...restProps}
/>
