<script lang="ts">
  import { onMount } from "svelte";
  import { Dialog, Label, Switch, Tabs, ToggleGroup } from "bits-ui";
  import Wheel from "$lib/components/Wheel.svelte";
  import { categories } from "$lib/data/categories";
  import { toast } from "$lib/toast.svelte";

  const STORAGE_KEY = "laewtae:v2";

  const SPEEDS = {
    fast: { label: "เร็ว", seconds: 2.5 },
    normal: { label: "ปกติ", seconds: 5 },
    slow: { label: "ช้า", seconds: 8 },
  } as const;
  type Speed = keyof typeof SPEEDS;

  // ---------- state ----------
  let selectedId = $state(categories[0].id);
  let lists = $state<Record<string, string[]>>(
    Object.fromEntries(categories.map((c) => [c.id, [...c.items]])),
  );
  let speed = $state<Speed>("normal");
  let noRepeat = $state(false);

  let result = $state<string | null>(null);
  let resultOpen = $state(false);
  let editOpen = $state(false);
  let newItem = $state("");
  let spinning = $state(false);
  let ready = $state(false);
  let wheel: ReturnType<typeof Wheel>;

  const category = $derived(categories.find((c) => c.id === selectedId)!);
  const items = $derived(lists[selectedId]);
  const mapsUrl = $derived(
    result
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result)}`
      : "",
  );

  // ---------- persist ----------
  onMount(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) {
        lists = { ...lists, ...saved.lists };
        if (saved.speed in SPEEDS) speed = saved.speed;
        noRepeat = !!saved.noRepeat;
      }
    } catch {
      /* ใช้ค่าเริ่มต้น */
    }
    ready = true;
  });

  $effect(() => {
    const snapshot = JSON.stringify({ lists, speed, noRepeat });
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, snapshot);
    } catch {
      /* เก็บไม่ได้ก็ไม่เป็นไร */
    }
  });

  // ---------- actions ----------
  function spin() {
    result = null;
    spinning = true;
    wheel.spin();
  }

  function onResult(item: string) {
    spinning = false;
    result = item;
    resultOpen = true;
    if (noRepeat) {
      lists[selectedId] = items.filter((x) => x !== item);
      toast.show(`เอา “${item}” ออกจากวงล้อแล้ว`);
    }
  }

  function again(dropResult: boolean) {
    if (dropResult && result !== null && !noRepeat) {
      lists[selectedId] = items.filter((x) => x !== result);
    }
    resultOpen = false;
    if (lists[selectedId].length >= 2) spin();
    else toast.show("ตัวเลือกไม่พอสุ่มแล้ว เพิ่มอีกหน่อยนะ");
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`${category.emoji} ${result}`);
      toast.show("คัดลอกแล้ว");
    } catch {
      toast.show("คัดลอกไม่ได้ ลองอีกครั้งนะ");
    }
  }

  function addItem() {
    const t = newItem.trim();
    if (!t) return;
    if (items.includes(t)) {
      toast.show("มีตัวเลือกนี้อยู่แล้ว");
      return;
    }
    lists[selectedId] = [...items, t];
    newItem = "";
    toast.show(`เพิ่ม “${t}” แล้ว`);
  }

  function removeItem(item: string) {
    lists[selectedId] = items.filter((x) => x !== item);
  }

  function resetItems() {
    lists[selectedId] = [...category.items];
    toast.show("รีเซ็ตตัวเลือกแล้ว");
  }

  // ---------- shared classes ----------
  const overlayCls =
    "fixed inset-0 z-40 bg-stone-900/30 backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out";
  const btnPrimary =
    "inline-flex items-center justify-center rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
  const btnGhost =
    "inline-flex items-center justify-center rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 active:scale-[0.98]";
</script>

<svelte:head>
  <title>แล้วแต่ — เลิกแล้วแต่ มาสุ่มกัน</title>
</svelte:head>

<main class="mx-auto flex max-w-md flex-col px-5 pt-2 pb-10">
  <p class="text-sm text-stone-500">เลิกแล้วแต่ มาสุ่มกัน</p>

  <!-- Tabs: หมวดหมู่ + วงล้อ -->
  <Tabs.Root
    bind:value={selectedId}
    onValueChange={() => (result = null)}
    class="mt-5"
  >
    <Tabs.List
      aria-label="หมวดหมู่"
      class="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
    >
      {#each categories as c (c.id)}
        <Tabs.Trigger
          value={c.id}
          disabled={spinning}
          class="shrink-0 rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-sm font-medium whitespace-nowrap text-stone-700 transition hover:border-stone-400 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:opacity-50 data-[state=active]:border-stone-900 data-[state=active]:bg-stone-900 data-[state=active]:text-white data-[state=active]:hover:bg-stone-900"
        >
          <span aria-hidden="true">{c.emoji}</span>
          {c.name}
        </Tabs.Trigger>
      {/each}
    </Tabs.List>

    <Tabs.Content value={selectedId} class="mt-10 outline-none">
      <Wheel
        bind:this={wheel}
        {items}
        duration={SPEEDS[speed].seconds}
        onresult={onResult}
      />
    </Tabs.Content>
  </Tabs.Root>

  <!-- ปุ่มสุ่ม -->
  <div class="mt-10">
    <button
      onclick={spin}
      disabled={spinning || items.length < 2}
      class="{btnPrimary} w-full py-4 text-base"
    >
      {spinning ? "กำลังสุ่ม…" : "สุ่มเลย"}
    </button>
    {#if items.length < 2}
      <p class="mt-2 text-center text-xs text-stone-400">
        ต้องมีอย่างน้อย 2 ตัวเลือก
      </p>
    {/if}
  </div>

  <!-- ตั้งค่า: ToggleGroup + Switch -->
  <section
    class="mt-6 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white"
  >
    <div class="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <span class="text-sm font-medium text-stone-700">ตัวเลือก</span>
        <p class="text-xs text-stone-400">{items.length} รายการ</p>
      </div>
      <button
        onclick={() => (editOpen = true)}
        disabled={spinning}
        class="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:bg-stone-100 active:scale-[0.98] disabled:opacity-50 {items.length <
        2
          ? 'border-stone-900 bg-stone-900 text-white hover:bg-stone-700'
          : ''}"
      >
        ✏️ แก้ไข
      </button>
    </div>

    <div class="flex items-center justify-between gap-4 px-4 py-3">
      <span class="text-sm font-medium text-stone-700">ความเร็ว</span>
      <ToggleGroup.Root
        type="single"
        bind:value={
          () => speed,
          (v) => {
            if (v) speed = v as Speed;
          }
        }
        disabled={spinning}
        aria-label="ความเร็วในการหมุน"
        class="flex rounded-full bg-stone-100 p-0.5"
      >
        {#each Object.entries(SPEEDS) as [key, s] (key)}
          <ToggleGroup.Item
            value={key}
            class="rounded-full px-3 py-1 text-xs font-semibold text-stone-500 transition disabled:opacity-50 data-[state=on]:bg-white data-[state=on]:text-stone-900 data-[state=on]:shadow-sm"
          >
            {s.label}
          </ToggleGroup.Item>
        {/each}
      </ToggleGroup.Root>
    </div>

    <div class="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <Label.Root for="norepeat" class="text-sm font-medium text-stone-700">
          ไม่สุ่มซ้ำ
        </Label.Root>
        <p class="text-xs text-stone-400">เอาผลที่ได้ออกจากวงล้อ</p>
      </div>
      <Switch.Root
        id="norepeat"
        bind:checked={noRepeat}
        disabled={spinning}
        class="inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-stone-200 px-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:opacity-50 data-[state=checked]:bg-brand"
      >
        <Switch.Thumb
          class="pointer-events-none block size-5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        />
      </Switch.Root>
    </div>
  </section>
</main>

<!-- Dialog: ผลลัพธ์ -->
<Dialog.Root bind:open={resultOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class={overlayCls} />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-7 text-center shadow-xl outline-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in"
    >
      <Dialog.Description class="text-sm text-stone-500">
        วันนี้เอา…
      </Dialog.Description>
      <Dialog.Title class="mt-2 text-3xl font-extrabold tracking-tight">
        <span aria-hidden="true">{category.emoji}</span>
        {result}
      </Dialog.Title>

      <div class="mt-7 flex flex-col gap-2">
        <button onclick={() => again(false)} class={btnPrimary}>
          สุ่มใหม่
        </button>
        <button onclick={() => again(true)} class={btnGhost}>
          ไม่เอาอันนี้ สุ่มต่อ
        </button>
        <div class="mt-1 flex justify-center gap-4 text-sm">
          {#if category.maps}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-brand underline-offset-4 hover:underline"
            >
              เปิดใน Maps
            </a>
          {/if}
          <button
            onclick={copyResult}
            class="font-medium text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            คัดลอก
          </button>
          <Dialog.Close
            class="font-medium text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            ปิด
          </Dialog.Close>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<!-- Dialog: แก้ไขตัวเลือก (bottom sheet บนมือถือ) -->
<Dialog.Root bind:open={editOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class={overlayCls} />
    <Dialog.Content
      class="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl outline-none data-[state=closed]:animate-slide-down data-[state=open]:animate-slide-up sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:data-[state=closed]:animate-pop-out sm:data-[state=open]:animate-pop-in"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <Dialog.Title class="text-lg font-bold tracking-tight">
            {category.emoji}
            {category.name}
          </Dialog.Title>
          <Dialog.Description class="mt-0.5 text-sm text-stone-500">
            {items.length} ตัวเลือก
          </Dialog.Description>
        </div>
        {#if category.items.length > 0}
          <button
            onclick={resetItems}
            class="text-sm text-stone-500 underline underline-offset-4 hover:text-stone-900"
          >
            รีเซ็ต
          </button>
        {/if}
      </div>

      <form
        class="mt-4 flex gap-2"
        onsubmit={(e) => {
          e.preventDefault();
          addItem();
        }}
      >
        <input
          bind:value={newItem}
          maxlength="40"
          placeholder="เพิ่มตัวเลือกของคุณ…"
          class="min-w-0 flex-1 rounded-full border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm outline-none focus:border-stone-900 focus:bg-white"
        />
        <button type="submit" class={btnPrimary}>เพิ่ม</button>
      </form>

      <ul class="mt-4 flex flex-wrap gap-2">
        {#each items as item (item)}
          <li
            class="flex items-center gap-0.5 rounded-full border border-stone-200 bg-stone-50 py-0.5 pr-0.5 pl-3 text-sm"
          >
            {item}
            <button
              onclick={() => removeItem(item)}
              aria-label="ลบ {item}"
              class="flex size-6 items-center justify-center rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-900"
            >
              ×
            </button>
          </li>
        {:else}
          <li class="text-sm text-stone-400">ยังไม่มีตัวเลือก ลองเพิ่มด้านบนดู</li>
        {/each}
      </ul>

      <Dialog.Close class="{btnGhost} mt-6 w-full">เสร็จแล้ว</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
