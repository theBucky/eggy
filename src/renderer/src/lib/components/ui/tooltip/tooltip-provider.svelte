<script lang="ts">
	import { Tooltip as TooltipPrimitive } from "bits-ui";

	// The first tooltip waits so it never shows up by accident. Moving to another trigger within
	// the skip window opens it instantly; staying away longer brings the delay back.
	let { delayDuration = 500, skipDelayDuration = 300, ...restProps }: TooltipPrimitive.ProviderProps = $props();
</script>

<TooltipPrimitive.Provider {delayDuration} {skipDelayDuration} {...restProps} />
