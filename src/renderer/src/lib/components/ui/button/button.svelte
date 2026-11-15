<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";

	export const buttonVariants = tv({
		base: "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:ring-1 aria-invalid:ring-inset aria-invalid:ring-destructive text-sm font-normal active:not-aria-[haspopup]:translate-y-px group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
		variants: {
			variant: {
				default: "ring-1 ring-inset ring-input text-foreground-secondary hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
				primary: "bg-primary text-primary-foreground hover:bg-primary/90",
				secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover aria-expanded:bg-secondary-hover",
				ghost: "text-foreground-secondary hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
				destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
				"destructive-secondary": "bg-destructive/10 text-destructive hover:bg-destructive/16",
				link: "text-info underline-offset-4 hover:underline",
			},
			size: {
				default: "h-7 rounded-lg gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				sm: "h-6 rounded-md gap-1 px-2 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
				lg: "h-8 rounded-lg gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
				icon: "size-6 rounded-md",
				"icon-sm": "size-5 rounded-md [&_svg:not([class*='size-'])]:size-3",
				"icon-lg": "size-8 rounded-lg [&_svg:not([class*='size-'])]:size-4",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
	export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = "default",
		size = "default",
		ref = $bindable(null),
		href = undefined,
		type = "button",
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? "link" : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
