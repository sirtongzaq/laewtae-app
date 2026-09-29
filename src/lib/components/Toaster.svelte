<script lang="ts">
  import { fly } from "svelte/transition";
  import { toast } from "$lib/toast.svelte";
</script>

<div
  class="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4"
  role="status"
  aria-live="polite"
>
  {#each toast.list as t (t.id)}
    <div
      transition:fly={{ y: 12, duration: 180 }}
      class="pointer-events-auto rounded-full bg-stone-900 px-4 py-2 text-sm text-white shadow-lg"
    >
      {t.message}
    </div>
  {/each}
</div>
