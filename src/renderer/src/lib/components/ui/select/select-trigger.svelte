<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import IconChevronDown from '@tabler/icons-svelte/icons/chevron-down';
	import { cn, type WithoutChild } from "$lib/utils.js";
	import { getSelectTrigger } from "./select.svelte";

	let {
		ref = $bindable(null),
		class: className,
		children,
		size = "default",
		...restProps
	}: WithoutChild<SelectPrimitive.TriggerProps> & {
		size?: "sm" | "default";
	} = $props();

	const sizes = {
		default: "h-7 rounded-lg border-border bg-popover py-1 pr-1.25 pl-1.75",
		sm: "h-6 rounded-md border-transparent py-0.5 pr-1 pl-1.5 text-muted-foreground",
	};

	const trigger = getSelectTrigger();
</script>

<SelectPrimitive.Trigger
	bind:ref={
		() => ref,
		(node) => {
			ref = node;
			trigger.node = node;
		}
	}
	data-slot="select-trigger"
	data-size={size}
	class={cn(
		"data-placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/15 aria-invalid:border-destructive gap-1 border text-sm *:data-[slot=select-value]:flex *:data-[slot=select-value]:gap-1.5 flex w-fit items-center justify-between whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:items-center [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
		sizes[size],
		className
	)}
	{...restProps}
>
	{@render children?.()}
	<IconChevronDown class="text-foreground-secondary size-2.5 pointer-events-none" />
</SelectPrimitive.Trigger>
