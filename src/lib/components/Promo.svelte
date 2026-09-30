<script lang="ts">
  // การ์ดแนะนำเว็บพี่น้อง "เดี๋ยวโอน" (หารบิล + QR PromptPay) หลังได้ผลลัพธ์
  // - ติดป้ายชัดว่าเป็นคำแนะนำจากผู้สร้างแอป ไม่ปลอมเป็นเนื้อหาของแอป
  // - ปิดได้ และจำว่าปิดแล้ว 1 วัน (เก็บใน localStorage เท่านั้น ไม่ติดตามตัวตนผู้ใช้)
  import { onMount } from "svelte";

  let { categoryId = "" }: { categoryId?: string } = $props();

  const KEY = "laewtae:promo:diawon";
  const HIDE_MS = 1 * 86_400_000;
  const URL = "https://diawon-app.vercel.app/?utm_source=laewtae&utm_medium=result_card";

  // เริ่มที่ "ซ่อน" เพื่อไม่ให้กะพริบตอน SSR/hydrate แล้วค่อยแสดงหลังเช็กจากเครื่อง
  let visible = $state(false);

  // เคยกด × ภายใน 1 วันหรือไม่ (ทุกหน้า/ทุกโหมดใช้ key เดียวกัน)
  function check() {
    try {
      const at = Number(localStorage.getItem(KEY) ?? 0);
      visible = !(at && Date.now() - at < HIDE_MS);
    } catch {
      visible = true;
    }
  }

  onMount(() => {
    check();
    // ปิดจากแท็บอื่นแล้ว แท็บนี้ก็หายด้วย
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) check();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  });

  function dismiss() {
    visible = false;
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* เก็บไม่ได้ก็แค่ซ่อนรอบนี้ */
    }
  }

  const isMeal = $derived(categoryId === "food" || categoryId === "cafe");
</script>

{#if visible}
  <aside
    aria-label="แนะนำจากผู้สร้างแอป"
    class="relative mt-1 rounded-2xl border border-stone-200 bg-stone-50 p-3 pr-10 text-left"
  >
    <p class="text-[11px] font-medium tracking-wide text-stone-400">แนะนำจากผู้สร้างแอปนี้</p>
    <p class="mt-1 text-sm font-semibold">
      {isMeal ? "กินเสร็จต้องหารบิลใช่ไหม?" : "มีบิลต้องหารกับเพื่อนไหม?"}
    </p>
    <p class="mt-0.5 text-xs text-stone-500">
      <span class="font-semibold text-stone-700">เดี๋ยวโอน</span> หารบิลให้ ส่ง QR PromptPay รายคน ไม่ต้องทวงเอง
    </p>
    <a
      href={URL}
      target="_blank"
      rel="noopener"
      class="mt-2 inline-flex min-h-9 items-center rounded-full bg-brand px-4 text-xs font-semibold text-white transition active:scale-[0.98]"
    >
      ลองใช้ →
    </a>
    <button
      onclick={dismiss}
      aria-label="ปิดคำแนะนำนี้"
      class="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-900"
    >
      <span aria-hidden="true">×</span>
    </button>
  </aside>
{/if}
