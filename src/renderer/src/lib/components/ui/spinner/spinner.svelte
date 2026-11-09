<script lang="ts">
	import type { SVGAttributes } from "svelte/elements";
	import "./spinner.css";

	let props: SVGAttributes<SVGSVGElement> = $props();
</script>

<span data-slot="spinner" class="inline-flex shrink-0">
	<svg role="status" aria-label="Loading" width="16" height="16" viewBox="0 0 24 24" fill="none" {...props}>
		<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
	</svg>
</span>
