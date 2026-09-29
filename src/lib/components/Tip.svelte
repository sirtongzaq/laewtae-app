<script lang="ts">
  import { Tooltip } from "bits-ui";
  import type { Snippet } from "svelte";

  type Props = Omit<Tooltip.TriggerProps, "children"> & {
    text: string;
    children: Snippet;
  };

  let { text, children, ...rest }: Props = $props();
</script>

<!-- ปุ่มที่มี tooltip (ต้องมี Tooltip.Provider ครอบใน +layout.svelte) -->
<Tooltip.Root>
  <Tooltip.Trigger aria-label={text} {...rest}>
    {@render children()}
  </Tooltip.Trigger>
  <Tooltip.Portal>
    <Tooltip.Content
      sideOffset={6}
      class="z-[70] rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-md data-[state=delayed-open]:animate-fade-in data-[state=closed]:animate-fade-out"
    >
      {text}
    </Tooltip.Content>
  </Tooltip.Portal>
</Tooltip.Root>
