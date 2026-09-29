<script lang="ts">
  type Card = { id: string; title: string };
  type Props = {
    /** การ์ดที่ยังไม่ได้ปัด (ใบแรกคือใบบนสุด) */
    cards: Card[];
    emoji?: string;
    disabled?: boolean;
    onswipe: (id: string, liked: boolean) => void;
  };

  let { cards, emoji = "", disabled = false, onswipe }: Props = $props();

  const THRESHOLD = 90; // ลากเกินกี่ px ถึงนับว่าปัด

  let dx = $state(0);
  let dragging = $state(false);
  let leaving = $state<"left" | "right" | null>(null);
  let startX = 0;

  const top = $derived(cards[0]);
  const behind = $derived(cards[1]);
  const strength = $derived(Math.min(Math.abs(dx) / THRESHOLD, 1));

  function down(e: PointerEvent) {
    if (disabled || leaving || !top) return;
    dragging = true;
    startX = e.clientX - dx;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (dragging) dx = e.clientX - startX;
  }

  function up() {
    if (!dragging) return;
    dragging = false;
    if (Math.abs(dx) > THRESHOLD) commit(dx > 0);
    else dx = 0;
  }

  function commit(liked: boolean) {
    if (!top || leaving || disabled) return;
    const id = top.id;
    leaving = liked ? "right" : "left";
    dx = liked ? 500 : -500;
    // รอให้การ์ดเลื่อนออกก่อนค่อยบันทึกและขึ้นใบถัดไป
    setTimeout(() => {
      onswipe(id, liked);
      leaving = null;
      dx = 0;
    }, 200);
  }

  function onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable]")) return;
    if (e.key === "ArrowRight") commit(true);
    else if (e.key === "ArrowLeft") commit(false);
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="mx-auto w-full max-w-xs">
  <div class="relative h-72 select-none">
    {#if top}
      <!-- ใบถัดไป (ซ้อนอยู่ข้างหลัง) -->
      <div
        class="absolute inset-0 rounded-3xl border border-stone-200 bg-white/70"
        style="transform: scale({0.94 + strength * 0.06});"
        aria-hidden="true"
      >
        {#if behind}
          <p class="flex h-full items-center justify-center px-6 text-center text-xl font-bold text-stone-300">
            {behind.title}
          </p>
        {/if}
      </div>

      {#key top.id}
        <div
          role="group"
          aria-label="การ์ด {top.title}"
          class="absolute inset-0 flex touch-pan-y flex-col items-center justify-center rounded-3xl border border-stone-300 bg-white p-6 text-center shadow-lg {dragging
            ? 'cursor-grabbing'
            : 'cursor-grab transition-transform duration-200'}"
          style="transform: translateX({dx}px) rotate({dx / 18}deg);"
          onpointerdown={down}
          onpointermove={move}
          onpointerup={up}
          onpointercancel={up}
        >
          {#if emoji}
            <span class="text-5xl" aria-hidden="true">{emoji}</span>
          {/if}
          <p class="mt-4 text-3xl leading-tight font-extrabold tracking-tight break-words">
            {top.title}
          </p>

          <!-- ป้ายบอกทิศทาง -->
          <span
            class="absolute top-5 left-5 -rotate-12 rounded-lg border-2 border-emerald-500 px-2.5 py-0.5 text-sm font-extrabold text-emerald-600"
            style="opacity: {dx > 0 ? strength : 0}"
            aria-hidden="true">เอา</span
          >
          <span
            class="absolute top-5 right-5 rotate-12 rounded-lg border-2 border-rose-500 px-2.5 py-0.5 text-sm font-extrabold text-rose-600"
            style="opacity: {dx < 0 ? strength : 0}"
            aria-hidden="true">ไม่เอา</span
          >
        </div>
      {/key}
    {:else}
      <div
        class="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-dashed border-stone-300 text-center"
      >
        <span class="text-4xl" aria-hidden="true">🎉</span>
        <p class="mt-3 font-bold">ปัดครบทุกใบแล้ว</p>
        <p class="mt-1 text-sm text-stone-500">รอเพื่อน ๆ ปัดให้ครบ…</p>
      </div>
    {/if}
  </div>

  <!-- ปุ่ม (ใช้แทนการลากได้ / ใช้ลูกศรซ้าย-ขวาบนคีย์บอร์ดได้เช่นกัน) -->
  <div class="mt-6 flex items-center justify-center gap-8">
    <button
      onclick={() => commit(false)}
      disabled={!top || disabled}
      aria-label="ไม่เอา"
      class="flex size-16 items-center justify-center rounded-full border border-stone-300 bg-white text-2xl text-rose-500 shadow-sm transition hover:bg-rose-50 active:scale-95 disabled:opacity-40"
    >
      ✕
    </button>
    <button
      onclick={() => commit(true)}
      disabled={!top || disabled}
      aria-label="เอา"
      class="flex size-16 items-center justify-center rounded-full border border-stone-300 bg-white text-2xl text-emerald-500 shadow-sm transition hover:bg-emerald-50 active:scale-95 disabled:opacity-40"
    >
      ♥
    </button>
  </div>
</div>
