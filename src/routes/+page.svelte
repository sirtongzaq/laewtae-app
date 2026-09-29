<script lang="ts">
  import { onMount } from "svelte";
  import Wheel from "$lib/components/Wheel.svelte";
  import { categories } from "$lib/data/categories";

  const STORAGE_KEY = "laewtae:items:v1";

  let selectedId = $state(categories[0].id);
  let lists = $state<Record<string, string[]>>(
    Object.fromEntries(categories.map((c) => [c.id, [...c.items]])),
  );
  let result = $state<string | null>(null);
  let newItem = $state("");
  let wheel: ReturnType<typeof Wheel>;
  let spinning = $state(false);
  let ready = $state(false);

  const category = $derived(categories.find((c) => c.id === selectedId)!);
  const items = $derived(lists[selectedId]);

  onMount(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) lists = { ...lists, ...JSON.parse(saved) };
    } catch {}
    ready = true;
  });

  $effect(() => {
    const snapshot = JSON.stringify(lists);
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, snapshot);
    } catch {}
  });

  function selectCategory(id: string) {
    if (spinning) return;
    selectedId = id;
    result = null;
  }

  function spin() {
    result = null;
    spinning = true;
    wheel.spin();
  }

  function onResult(item: string) {
    spinning = false;
    result = item;
  }

  function addItem() {
    const t = newItem.trim();
    if (!t || items.includes(t)) return;
    lists[selectedId] = [...items, t];
    newItem = "";
  }

  function removeItem(i: number) {
    lists[selectedId] = items.filter((_, idx) => idx !== i);
    result = null;
  }

  function removeResultAndSpin() {
    if (result === null) return;
    lists[selectedId] = items.filter((x) => x !== result);
    result = null;
    if (lists[selectedId].length >= 2) queueMicrotask(spin);
  }

  function resetItems() {
    lists[selectedId] = [...category.items];
    result = null;
  }

  const mapsUrl = $derived(
    result
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result)}`
      : "",
  );
</script>

<svelte:head>
  <title>แล้วแต่ — เลิกแล้วแต่ มาสุ่มกัน</title>
</svelte:head>

<main class="mx-auto min-h-screen max-w-xl bg-orange-50 px-4 pt-8 pb-16">
  <header class="text-center">
    <h1 class="text-4xl font-extrabold text-brand">แล้วแต่ 🎲</h1>
    <p class="mt-1 text-slate-600">เลิกแล้วแต่ มาสุ่มกัน</p>
  </header>

  <!-- หมวดหมู่ -->
  <nav class="mt-6 flex flex-wrap justify-center gap-2" aria-label="หมวดหมู่">
    {#each categories as c (c.id)}
      <button
        onclick={() => selectCategory(c.id)}
        disabled={spinning}
        class="rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition
          disabled:opacity-60
          {c.id === selectedId
          ? 'bg-brand text-white'
          : 'bg-white text-slate-700 hover:bg-orange-100'}"
      >
        {c.emoji}
        {c.name}
      </button>
    {/each}
  </nav>

  <!-- วงล้อ -->
  <section class="mt-8 px-2">
    <Wheel bind:this={wheel} {items} onresult={onResult} />

    <div class="mt-6 text-center">
      <button
        onclick={spin}
        disabled={spinning || items.length < 2}
        class="rounded-full bg-brand px-10 py-4 text-xl font-extrabold text-white shadow-lg
          transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {spinning ? "กำลังสุ่ม…" : "สุ่มเลย!"}
      </button>
      {#if items.length < 2}
        <p class="mt-2 text-sm text-slate-500">ต้องมีอย่างน้อย 2 ตัวเลือก</p>
      {/if}
    </div>
  </section>

  <!-- ผลลัพธ์ -->
  {#if result}
    <section
      class="mt-6 rounded-3xl bg-white p-6 text-center shadow-lg ring-2 ring-brand"
      aria-live="polite"
    >
      <p class="text-sm text-slate-500">วันนี้เอา…</p>
      <p class="mt-1 text-3xl font-extrabold text-slate-800">
        {category.emoji}
        {result}
      </p>
      <div class="mt-4 flex flex-wrap justify-center gap-2">
        <button
          onclick={spin}
          class="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
        >
          🔄 สุ่มใหม่
        </button>
        <button
          onclick={removeResultAndSpin}
          class="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
        >
          🙅 ไม่เอาอันนี้ สุ่มต่อ
        </button>
        {#if category.maps}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            📍 ค้นหาใน Google Maps
          </a>
        {/if}
      </div>
    </section>
  {/if}

  <!-- แก้ไขตัวเลือก -->
  <section class="mt-10 rounded-3xl bg-white p-5 shadow">
    <div class="flex items-center justify-between">
      <h2 class="font-bold text-slate-800">
        ตัวเลือกใน “{category.name}” ({items.length})
      </h2>
      {#if category.items.length > 0}
        <button
          onclick={resetItems}
          disabled={spinning}
          class="text-sm text-slate-500 underline hover:text-slate-700 disabled:opacity-50"
        >
          รีเซ็ต
        </button>
      {/if}
    </div>

    <form
      class="mt-3 flex gap-2"
      onsubmit={(e) => {
        e.preventDefault();
        addItem();
      }}
    >
      <input
        bind:value={newItem}
        maxlength="40"
        placeholder="เพิ่มตัวเลือกของคุณ…"
        class="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-2 outline-none focus:border-brand"
      />
      <button
        type="submit"
        disabled={spinning}
        class="rounded-full bg-slate-800 px-5 py-2 font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
      >
        เพิ่ม
      </button>
    </form>

    <ul class="mt-4 flex flex-wrap gap-2">
      {#each items as item, i (item)}
        <li
          class="flex items-center gap-1 rounded-full bg-orange-100 py-1 pr-1 pl-3 text-sm text-slate-800"
        >
          {item}
          <button
            onclick={() => removeItem(i)}
            disabled={spinning}
            aria-label="ลบ {item}"
            class="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-orange-200 hover:text-slate-800 disabled:opacity-50"
          >
            ×
          </button>
        </li>
      {/each}
      {#if items.length === 0}
        <li class="text-sm text-slate-400">
          ยังไม่มีตัวเลือก ลองเพิ่มด้านบนดู
        </li>
      {/if}
    </ul>
  </section>
</main>
