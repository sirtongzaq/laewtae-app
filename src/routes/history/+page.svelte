<script lang="ts">
  import { categories } from "$lib/data/categories";
  import { recents, timeAgo, type ResultSource } from "$lib/recents.svelte";
  import { toast } from "$lib/toast.svelte";

  const catOf = (id: string) => categories.find((c) => c.id === id) ?? categories[0];
  const SOURCE: Record<ResultSource, { label: string; emoji: string }> = {
    solo: { label: "สุ่มคนเดียว", emoji: "🎲" },
    vote: { label: "โหวตกับเพื่อน", emoji: "🗳️" },
    swipe: { label: "ปัดกับเพื่อน", emoji: "👆" },
  };

  const fmt = (ts: number) =>
    new Date(ts).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

  let openKey = $state<string | null>(null);
  const keyOf = (r: { at: number; title: string }) => `${r.at}:${r.title}`;
</script>

<main class="mx-auto max-w-md px-5 pt-6 pb-10">
  <div class="flex items-end justify-between gap-3">
    <div>
      <h1 class="text-2xl font-extrabold tracking-tight">ประวัติการสุ่ม</h1>
      <p class="mt-1 text-sm text-stone-500">เก็บในเครื่องนี้เท่านั้น</p>
    </div>
    {#if recents.results.length}
      <button
        onclick={() => {
          recents.clear();
          toast.show("ล้างประวัติแล้ว");
        }}
        class="text-xs text-stone-400 underline underline-offset-4 hover:text-stone-700"
      >
        ล้างทั้งหมด
      </button>
    {/if}
  </div>

  {#if recents.results.length === 0}
    <section class="mt-6 rounded-2xl border border-stone-200 bg-white p-8 text-center">
      <p class="text-3xl" aria-hidden="true">🕘</p>
      <p class="mt-2 text-sm text-stone-500">ยังไม่มีประวัติ ลองสุ่มดูสักครั้งนะ</p>
      <a
        href="/"
        class="mt-4 inline-flex rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-700"
      >
        ไปสุ่มเลย
      </a>
    </section>
  {:else}
    <ul class="mt-6 space-y-2">
      {#each recents.results as r (keyOf(r))}
        {@const c = catOf(r.category)}
        {@const k = keyOf(r)}
        <li class="rounded-2xl border border-stone-200 bg-white">
          <button
            onclick={() => (openKey = openKey === k ? null : k)}
            aria-expanded={openKey === k}
            class="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <span class="text-2xl" aria-hidden="true">{c.emoji}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-bold">{r.title}</span>
              <span class="block text-xs text-stone-400">
                {SOURCE[r.source].emoji}
                {SOURCE[r.source].label} · {c.name}
                {#if r.from?.length}· จาก {r.from.length} ตัวเลือก{/if}
              </span>
            </span>
            <span class="text-xs text-stone-400">{timeAgo(r.at)}</span>
          </button>

          {#if openKey === k}
            <div class="space-y-3 border-t border-stone-100 px-4 py-3 text-sm">
              <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt class="text-stone-400">เวลา</dt>
                <dd>{fmt(r.at)}</dd>
                <dt class="text-stone-400">โหมด</dt>
                <dd>{SOURCE[r.source].label}</dd>
                <dt class="text-stone-400">หมวดหมู่</dt>
                <dd>{c.emoji} {c.name}</dd>
                {#if r.code}
                  <dt class="text-stone-400">ห้อง</dt>
                  <dd class="font-mono tracking-widest">{r.code}</dd>
                {/if}
              </dl>

              {#if r.from?.length}
                <div>
                  <p class="text-stone-400">สุ่มจาก</p>
                  <ul class="mt-1.5 flex flex-wrap gap-1.5">
                    {#each r.from as t (t)}
                      <li
                        class="rounded-full border px-2.5 py-0.5 text-xs
                          {t === r.title
                          ? 'border-stone-900 bg-stone-900 font-semibold text-white'
                          : 'border-stone-200 text-stone-600'}"
                      >
                        {t}
                      </li>
                    {/each}
                  </ul>
                </div>
              {:else}
                <p class="text-xs text-stone-400">ไม่มีข้อมูลตัวเลือกของรายการนี้</p>
              {/if}

              <div class="flex items-center justify-between pt-1">
                {#if r.code}
                  <a
                    href="/room/{r.code}"
                    class="text-xs font-medium text-brand underline-offset-4 hover:underline"
                  >
                    เปิดห้อง (ถ้ายังไม่หมดอายุ)
                  </a>
                {:else}
                  <span></span>
                {/if}
                <button
                  onclick={() => recents.removeResult(r.at, r.title)}
                  class="text-xs text-stone-400 underline underline-offset-4 hover:text-stone-700"
                >
                  ลบรายการนี้
                </button>
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</main>
