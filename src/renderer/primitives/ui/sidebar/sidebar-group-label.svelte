<script lang="ts">
	import { cn, type WithElementRef } from "$primitives/utils.js";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		children,
		child,
		class: className,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> & {
		child?: Snippet<[{ props: Record<string, unknown> }]>;
	} = $props();

	const mergedProps = $derived({
		class: cn(
			"text-muted-foreground ring-sidebar-ring h-7.5 gap-1 rounded-xl pr-1 pl-2.5 text-sm transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 ring-inset focus-visible:ring-1 [&>svg]:size-3 flex shrink-0 items-center outline-hidden [&>svg]:shrink-0",
			className
		),
		"data-slot": "sidebar-group-label",
		"data-sidebar": "group-label",
		...restProps,
	});
</script>

{#if child}
	{@render child({ props: mergedProps })}
{:else}
	<div bind:this={ref} {...mergedProps}>
		{@render children?.()}
	</div>
{/if}
