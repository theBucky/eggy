<script lang="ts" module>
	import { createContext } from "svelte";

	type Trigger = { node: HTMLElement | null; pouring: boolean };

	// The content draws its surface out of the trigger, so it needs the trigger's element, and the
	// trigger needs to know for how long that surface is out.
	export const [getSelectTrigger, setSelectTrigger] = createContext<Trigger>();
</script>

<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";

	let {
		open = $bindable(false),
		value = $bindable(),
		...restProps
	}: SelectPrimitive.RootProps = $props();

	const trigger: Trigger = $state({ node: null, pouring: false });
	setSelectTrigger(trigger);
</script>

<SelectPrimitive.Root bind:open bind:value={value as never} {...restProps} />
