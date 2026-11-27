<!-- Adapted from Fluid Functionalism's switch, MIT License, Copyright (c) 2026 Micka Touillaud. -->
<script lang="ts" module>
	const TRACK_WIDTH = 26;
	const TRACK_HEIGHT = 16;
	const THUMB = 12;
	const INSET = (TRACK_HEIGHT - THUMB) / 2;
	const HOVER_EXTEND = 2;
	const PRESS_EXTEND = 4;
	const PRESS_SHRINK = 2;
	const DRAG_THRESHOLD = 2;
	const DRAG_END = TRACK_WIDTH - INSET - (THUMB + PRESS_EXTEND);
	const DRAG_MIDPOINT = (INSET + DRAG_END) / 2;

	type Press = { pointerX: number; x: number | undefined };
</script>

<script lang="ts">
	import { mergeProps, Switch as SwitchPrimitive } from "bits-ui";
	import { cn, type WithoutChildrenOrChild } from "$primitives/utils.js";

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
	let dragged = false;

	const width = $derived(THUMB + (press ? PRESS_EXTEND : hovered && !disabled ? HOVER_EXTEND : 0));
	const height = $derived(THUMB - (press ? PRESS_SHRINK : 0));
	const rest = $derived(checked ? TRACK_WIDTH - INSET - width : INSET);
	const x = $derived(press?.x ?? rest);

	function onpointerdown(event: PointerEvent & { currentTarget: HTMLButtonElement }): void {
		dragged = false;

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
		"data-checked:bg-success data-unchecked:bg-secondary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring relative shrink-0 touch-none rounded-full transition-colors duration-80 select-none data-disabled:opacity-50",
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
			if (!dragged) return;

			dragged = false;
			event.preventDefault();
		},
	})}
>
	<SwitchPrimitive.Thumb
		data-slot="switch-thumb"
		class={cn(
			"pointer-events-none absolute top-0 left-0 block rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/12%)] duration-160 ease-spring motion-reduce:transition-none",
			press?.x === undefined ? "transition-[translate,width,height]" : "transition-[width,height]"
		)}
		style="width: {width}px; height: {height}px; translate: {x}px {(TRACK_HEIGHT - height) / 2}px"
	/>
</SwitchPrimitive.Root>
