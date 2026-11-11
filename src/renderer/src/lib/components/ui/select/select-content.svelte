<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { cn, type WithoutChild } from "$lib/utils.js";
	import type { WithoutChildrenOrChild } from "$lib/utils.js";
	import SelectPortal from "./select-portal.svelte";
	import SelectScrollDownButton from "./select-scroll-down-button.svelte";
	import SelectScrollUpButton from "./select-scroll-up-button.svelte";
	import { getSelectTrigger } from "./select.svelte";
	import type { ComponentProps } from "svelte";

	const filterId = $props.id();

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 8,
		portalProps,
		children,
		preventScroll = true,
		...restProps
	}: WithoutChild<SelectPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof SelectPortal>>;
	} = $props();

	const trigger = getSelectTrigger();

	// Holds a newly mounted menu inside the trigger until bits-ui has placed it.
	let placing = $state(true);

	function track(frame: HTMLElement) {
		const wrapper = frame.parentElement;
		const node = trigger.node;
		if (!wrapper || !node) throw new Error("Select.Content needs a Select.Trigger to flow out of");
		const placed = requestAnimationFrame(() => (placing = false));
		// The trigger's box, as insets from the menu's box.
		const measure = () => {
			const menu = wrapper.getBoundingClientRect();
			const box = node.getBoundingClientRect();
			frame.style.setProperty("--anchor-top", `${box.top - menu.top}px`);
			frame.style.setProperty("--anchor-right", `${menu.right - box.right}px`);
			frame.style.setProperty("--anchor-bottom", `${menu.bottom - box.bottom}px`);
			frame.style.setProperty("--anchor-left", `${box.left - menu.left}px`);
			// A transition starts from the last computed style, which would otherwise still hold the
			// box measured before the menu was placed.
			void frame.offsetWidth;
		};
		// bits-ui places the menu by rewriting the wrapper's inline transform.
		const moved = new MutationObserver(measure);
		moved.observe(wrapper, { attributeFilter: ["style"] });
		const resized = new ResizeObserver(measure);
		resized.observe(wrapper);
		resized.observe(node);
		measure();
		return () => {
			cancelAnimationFrame(placed);
			placing = true;
			moved.disconnect();
			resized.disconnect();
		};
	}
</script>

<SelectPortal {...portalProps}>
	<SelectPrimitive.Content
		bind:ref
		{sideOffset}
		{preventScroll}
		data-slot="select-content"
		class={cn(
			"text-popover-foreground min-w-32 rounded-lg z-50 max-h-(--bits-select-content-available-height) relative **:data-[slot$=-item]:focus:bg-foreground/10 **:data-[slot$=-item]:data-highlighted:bg-foreground/10 **:data-[slot$=-separator]:bg-foreground/5 **:data-[slot$=-trigger]:focus:bg-foreground/10 **:data-[slot$=-trigger]:aria-expanded:bg-foreground/10! **:data-[variant=destructive]:focus:bg-foreground/10! **:data-[variant=destructive]:text-accent-foreground! **:data-[variant=destructive]:**:text-accent-foreground!",
			className
		)}
		{...restProps}
	>
		{#snippet child({ wrapperProps, props, open })}
			<div {...wrapperProps}>
				<!-- Each part transitions between a state docked inside the trigger and its resting
				     one, so a press midway turns the menu back from wherever it is. -->
				<div
					class="frame"
					data-docked={placing ? "placing" : open ? undefined : "closing"}
					{@attach track}
				>
					<div {...props}>
						<SelectScrollUpButton />
						<SelectPrimitive.Viewport
							class={cn(
								"h-(--bits-select-anchor-height) w-full min-w-(--bits-select-anchor-width) p-1 scroll-py-1"
							)}
						>
							{@render children?.()}
						</SelectPrimitive.Viewport>
						<SelectScrollDownButton />
					</div>
					<div class="liquid" style:filter="url(#{filterId})" aria-hidden="true">
						<div class="blob trigger"></div>
						<div class="blob menu"></div>
					</div>
					<svg class="absolute size-0" aria-hidden="true">
						<!-- Blurring the two boxes and thresholding the result bridges them wherever they sit
						     close. The untouched boxes go back on top, so the blur only ever adds the bridge. -->
						<filter id={filterId} color-interpolation-filters="sRGB">
							<feGaussianBlur in="SourceAlpha" stdDeviation="4" />
							<feComponentTransfer>
								<feFuncA type="linear" slope="12" intercept="-5.5" />
							</feComponentTransfer>
							<feComposite in="SourceAlpha" operator="over" result="shape" />
							<!-- Everything deeper than 1px, which leaves a border of even width. feMorphology
							     erodes with a square and would thicken the corners. -->
							<feGaussianBlur stdDeviation="1" />
							<feComponentTransfer result="core">
								<feFuncA type="linear" slope="12" intercept="-9.6" />
							</feComponentTransfer>
							<feFlood style="flood-color: var(--surface)" />
							<feComposite in2="shape" operator="in" result="fill" />
							<feFlood style="flood-color: var(--input)" />
							<feComposite in2="shape" operator="in" />
							<feComposite in2="core" operator="out" result="border" />
							<feMerge>
								<feMergeNode in="fill" />
								<feMergeNode in="border" />
							</feMerge>
						</filter>
					</svg>
				</div>
			</div>
		{/snippet}
	</SelectPrimitive.Content>
</SelectPortal>

<style>
	.frame {
		/* Passes the resting value by 3% and settles back. */
		--spring: linear(
			0,
			0.007 1.2%,
			0.029 2.8%,
			0.072 4.5%,
			0.137 6.5%,
			0.252 9.5%,
			0.508 15.8%,
			0.628 19%,
			0.724 22%,
			0.806 25%,
			0.871 28%,
			0.927 31.2%,
			0.97 34.8%,
			1 38.5%,
			1.021 43%,
			1.03 49%,
			1.023 59.5%,
			1.003 79%,
			1
		);
		/* Done by 40%. bits-ui unmounts the menu when the content's transition ends, and the rest
		   keeps it mounted while the trigger's swell settles. */
		--collapse: linear(
			0,
			0.014 3%,
			0.051 5.4%,
			0.11 7.4%,
			0.191 9.2%,
			0.313 11.2%,
			0.537 14.6%,
			0.652 16.8%,
			0.749 19.2%,
			0.837 22.2%,
			0.908 25.8%,
			0.961 30.2%,
			0.993 35.6%,
			1 40%,
			1
		);
	}

	/* Nothing moves while the menu is being placed, which shifts the docked box under it. */
	@media (prefers-reduced-motion: no-preference) {
		/* The list runs the menu's curve slower, so it is still landing as the menu comes to rest. */
		.frame:not([data-docked]) {
			--menu-motion: 400ms var(--spring);
			--list-motion: 450ms var(--spring);
		}

		.frame[data-docked="closing"] {
			--menu-motion: 350ms var(--collapse);
			--list-motion: var(--menu-motion);
		}

		.frame[data-docked="closing"] .trigger {
			animation: swell 350ms;
		}
	}

	.liquid {
		/* How far the trigger sits outside the menu's box, plus room for the menu to spring past
		   its own. */
		--reach: calc(
			max(
					0px,
					-1 * var(--anchor-top),
					-1 * var(--anchor-right),
					-1 * var(--anchor-bottom),
					-1 * var(--anchor-left)
				) +
				16px
		);
		--docked: calc(var(--reach) + var(--anchor-top)) calc(var(--reach) + var(--anchor-right))
			calc(var(--reach) + var(--anchor-bottom)) calc(var(--reach) + var(--anchor-left));
		--hole-top: calc(var(--reach) + var(--anchor-top) + 4px);
		--hole-right: calc(100% - var(--reach) - var(--anchor-right) - 4px);
		--hole-bottom: calc(100% - var(--reach) - var(--anchor-bottom) - 4px);
		--hole-left: calc(var(--reach) + var(--anchor-left) + 4px);
		position: absolute;
		inset: calc(-1 * var(--reach));
		z-index: -1;
		pointer-events: none;
		/* The layer paints over the real trigger, whose label shows through this hole. */
		clip-path: polygon(
			evenodd,
			0 0,
			100% 0,
			100% 100%,
			0 100%,
			0 0,
			var(--hole-left) var(--hole-top),
			var(--hole-right) var(--hole-top),
			var(--hole-right) var(--hole-bottom),
			var(--hole-left) var(--hole-bottom),
			var(--hole-left) var(--hole-top)
		);
	}

	.blob {
		position: absolute;
		border-radius: var(--radius);
		background: #000;
	}

	/* A box and not a clip, which would round the corners differently from every other frame. */
	.menu {
		inset: var(--reach);
		transition: inset var(--menu-motion, 0s);
	}

	.trigger,
	.frame[data-docked] .menu {
		inset: var(--docked);
	}

	[data-slot="select-content"] {
		--pour: 0 -16px;
		clip-path: inset(0 round var(--radius));
		transition: clip-path var(--menu-motion, 0s);
	}

	[data-slot="select-content"][data-side="top"] {
		--pour: 0 16px;
	}

	[data-slot="select-content"][data-side="left"] {
		--pour: 16px 0;
	}

	[data-slot="select-content"][data-side="right"] {
		--pour: -16px 0;
	}

	.frame[data-docked] [data-slot="select-content"] {
		clip-path: inset(
			var(--anchor-top) var(--anchor-right) var(--anchor-bottom) var(--anchor-left) round
				var(--radius)
		);
	}

	.frame :global([data-select-viewport]) {
		transition: translate var(--list-motion, 0s);
	}

	/* The list pours out of the trigger as one. Moving each item would shift the boxes bits-ui
	   measures to pick the first highlight and to decide whether the list scrolls. A press while
	   it moves would land on whichever item had slid under the pointer. */
	.frame[data-docked] :global([data-select-viewport]) {
		translate: var(--pour);
		pointer-events: none;
	}

	.frame :global(:is([data-select-viewport] > *, [data-slot^="select-scroll"])) {
		transition: var(--list-motion, 0s);
		transition-property: opacity, filter;
	}

	.frame[data-docked] :global(:is([data-select-viewport] > *, [data-slot^="select-scroll"])) {
		opacity: 0;
		filter: blur(8px);
	}

	/* The item farthest from the trigger clears first, as the front of a pour would. The whole
	   cascade stays within 70ms however long the list. */
	.frame:not([data-docked]) :global([data-select-viewport] > *) {
		--step: min(20ms, 70ms / max(1, sibling-count() - 1));
		transition-delay: calc(var(--step) * (sibling-count() - sibling-index()));
	}

	.frame:not([data-docked])
		[data-slot="select-content"][data-side="top"]
		:global([data-select-viewport] > *) {
		transition-delay: calc(var(--step) * (sibling-index() - 1));
	}

	/* The trigger swallows the menu: a bulge as the menu lands, then a longer ease back. */
	@keyframes swell {
		0%,
		20% {
			box-shadow: 0 0 0 0 #000;
			animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
		}
		45% {
			box-shadow: 0 0 0 4px #000;
			animation-timing-function: ease-out;
		}
		100% {
			box-shadow: 0 0 0 0 #000;
		}
	}

	/* bits-ui holds the page inert until a closed menu unmounts, which would swallow every press
	   made while this one flows back into its trigger. */
	:global(body:has([data-slot="select-content"][data-state="closed"])) {
		pointer-events: auto !important;
	}
</style>
