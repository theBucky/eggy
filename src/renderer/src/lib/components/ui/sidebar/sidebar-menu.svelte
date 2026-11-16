<script lang="ts" module>
	// Set by the root menu, so sub-menus join its highlight and the whole tree has one.
	const TREE = Symbol("sidebar-menu-tree");
</script>

<script lang="ts">
	import { hasContext, setContext } from "svelte";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLUListElement>, HTMLUListElement> = $props();

	const root = !hasContext(TREE);

	setContext(TREE, true);
</script>

<ul
	bind:this={ref}
	data-fluid-hover={root ? "" : undefined}
	data-slot="sidebar-menu"
	data-sidebar="menu"
	class={cn("gap-0.5 flex w-full min-w-0 flex-col", root && "before:rounded-xl", className)}
	{...restProps}
>
	{@render children?.()}
</ul>
