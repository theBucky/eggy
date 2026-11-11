<!-- Adapted from Fluid Functionalism's switch, MIT License, Copyright (c) 2026 Micka Touillaud. -->
<script lang="ts" module>
	const TRACK_WIDTH = 34;
	const TRACK_HEIGHT = 18;
	const THUMB = 14;
	const INSET = (TRACK_HEIGHT - THUMB) / 2;
	const HOVER_EXTEND = 2;
	const PRESS_EXTEND = 4;
	const PRESS_SHRINK = 4;
	const DRAG_THRESHOLD = 2;
	const DRAG_END = TRACK_WIDTH - INSET - (THUMB + PRESS_EXTEND);
	const DRAG_MIDPOINT = (INSET + DRAG_END) / 2;

	type Press = { pointerX: number; x: number | undefined };
</script>

<script lang="ts">
	import { mergeProps, Switch as SwitchPrimitive } from "bits-ui";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		checked = $bindable(false),
		disabled = false,
		onCheckedChange,
		...restProps
	}: WithoutChildrenOrChild<SwitchPrimitive.RootProps> = $props();

	let press = $state<Press>();
	let hovered = $state(false);
	// Outlives the release by a frame, so the click that ends a drag can't toggle again.
	let dragged = false;

	const width = $derived(THUMB + (press ? PRESS_EXTEND : hovered && !disabled ? HOVER_EXTEND : 0));
	const height = $derived(THUMB - (press ? PRESS_SHRINK : 0));
	const rest = $derived(checked ? TRACK_WIDTH - INSET - width : INSET);
	const x = $derived(press?.x ?? rest);

	function onpointerdown(event: PointerEvent & { currentTarget: HTMLButtonElement }): void {
		if (disabled || event.button !== 0) return;

		press = { pointerX: event.clientX, x: undefined };
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	function onpointermove(event: PointerEvent): void {
		if (press === undefined) return;

		const delta = event.clientX - press.pointerX;

		if (press.x === undefined && Math.abs(delta) < DRAG_THRESHOLD) return;

		press.x = Math.min(Math.max(rest + delta, INSET), DRAG_END);
	}

	function onpointerup(): void {
		const released = press?.x;

		press = undefined;

		if (released === undefined) return;

		dragged = true;
		requestAnimationFrame(() => (dragged = false));

		if (released > DRAG_MIDPOINT !== checked) {
			checked = !checked;
			onCheckedChange?.(checked);
		}
	}
</script>

<SwitchPrimitive.Root
	bind:ref
	bind:checked
	{disabled}
	{onCheckedChange}
	data-slot="switch"
	class={cn(
		"data-checked:bg-info data-unchecked:bg-accent focus-visible:ring-ring focus-visible:ring-offset-background relative shrink-0 touch-none rounded-full transition-colors duration-80 outline-none select-none focus-visible:ring-1 focus-visible:ring-offset-2 data-disabled:opacity-50",
		className
	)}
	style="width: {TRACK_WIDTH}px; height: {TRACK_HEIGHT}px"
	{...mergeProps(restProps, {
		onpointerdown,
		onpointermove,
		onpointerup,
		onpointercancel: () => (press = undefined),
		onpointerenter: (event: PointerEvent) => (hovered = event.pointerType === "mouse"),
		onpointerleave: () => (hovered = false),
		onclick: (event: MouseEvent) => {
			if (dragged) event.preventDefault();
		},
	})}
>
	<SwitchPrimitive.Thumb
		data-slot="switch-thumb"
		class={cn(
			"pointer-events-none absolute top-0 left-0 block rounded-full bg-white shadow-sm duration-160 ease-spring motion-reduce:transition-none",
			press?.x === undefined ? "transition-[translate,width,height]" : "transition-[width,height]"
		)}
		style="width: {width}px; height: {height}px; translate: {x}px {(TRACK_HEIGHT - height) / 2}px"
	/>
</SwitchPrimitive.Root>
