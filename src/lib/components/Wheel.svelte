<script lang="ts">
  type Props = {
    items: string[];
    /** ระยะเวลาหมุน (วินาที) */
    duration?: number;
    onresult?: (item: string, index: number) => void;
  };

  let { items, duration = 5, onresult }: Props = $props();

  const SIZE = 200;
  const C = SIZE / 2;

  let rotation = $state(0);
  let spinning = $state(false);
  let pendingIndex = -1;

  const n = $derived(items.length);
  const slice = $derived(360 / Math.max(n, 1));

  function point(deg: number, r: number) {
    const rad = (deg * Math.PI) / 180;
    return [C + r * Math.sin(rad), C - r * Math.cos(rad)];
  }

  function slicePath(i: number) {
    const [x1, y1] = point(i * slice, C);
    const [x2, y2] = point((i + 1) * slice, C);
    const large = slice > 180 ? 1 : 0;
    return `M${C},${C} L${x1},${y1} A${C},${C} 0 ${large} 1 ${x2},${y2} Z`;
  }

  // มินิมอล: สลับสีพื้นสองโทน (ชิ้นสุดท้ายไม่ซ้ำสีกับชิ้นแรกเมื่อจำนวนคี่)
  // ใช้ class ของ Tailwind (fill-*) เพื่อให้เปลี่ยนตาม dark mode อัตโนมัติ
  function fillCls(i: number) {
    if (n > 1 && n % 2 === 1 && i === n - 1) return "fill-stone-200";
    return i % 2 === 0 ? "fill-white" : "fill-stone-100";
  }

  function label(text: string) {
    return text.length > 12 ? text.slice(0, 11) + "…" : text;
  }

  const fontSize = $derived(n > 14 ? 7 : n > 8 ? 9 : 11);

  function randomFloat() {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  }

  /**
   * หมุนไปหยุดที่ชิ้นที่กำหนด (deterministic — ใช้ซิงก์หลายเครื่องผ่าน Realtime)
   * @param index ชิ้นที่ชนะ
   * @param jitter ตำแหน่งภายในชิ้น -0.35…0.35 (สัดส่วนของชิ้น) ไม่ให้เข็มชี้กลางเป๊ะ
   */
  export function spinTo(index: number, jitter = 0) {
    if (spinning || n < 2 || index < 0 || index >= n) return;
    spinning = true;
    pendingIndex = index;

    // เข็มอยู่ด้านบน: มุมของวงล้อที่เข็มชี้ = (360 - rotation) mod 360
    const center = (index + 0.5) * slice;
    const base = Math.ceil(rotation / 360) * 360;
    rotation = base + 360 * 6 + (360 - center) + jitter * slice;
  }

  /** สุ่มเอง (โหมดปกติ) */
  export function spin() {
    if (spinning || n < 2) return;
    spinTo(Math.floor(randomFloat() * n), (randomFloat() - 0.5) * 0.7);
  }

  function onEnd(e: TransitionEvent) {
    if (e.propertyName !== "transform" || !spinning) return;
    spinning = false;
    if (pendingIndex >= 0) onresult?.(items[pendingIndex], pendingIndex);
  }
</script>

<div class="relative mx-auto aspect-square w-full max-w-xs select-none">
  <!-- เข็มชี้ -->
  <div
    class="absolute top-0 left-1/2 z-10 -translate-x-1/2 -translate-y-2"
    aria-hidden="true"
  >
    <svg width="26" height="30" viewBox="0 0 26 30">
      <path
        d="M13 30 L2 6 Q13 -3 24 6 Z"
        class="fill-brand stroke-stone-50"
        stroke-width="3"
        stroke-linejoin="round"
      />
    </svg>
  </div>

  <div
    class="h-full w-full rounded-full border border-stone-300 bg-white shadow-sm"
    style="transform: rotate({rotation}deg); transition: transform {spinning
      ? duration
      : 0}s cubic-bezier(0.12, 0.6, 0.1, 1);"
    ontransitionend={onEnd}
  >
    <svg viewBox="0 0 {SIZE} {SIZE}" class="h-full w-full">
      {#if n === 0}
        <text
          x={C}
          y={C}
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="12"
          font-weight="600"
          class="fill-stone-700">เพิ่มตัวเลือกก่อนนะ</text
        >
      {:else if n === 1}
        <text
          x={C}
          y={C}
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="11"
          font-weight="600"
          class="fill-stone-900">{label(items[0])}</text
        >
      {:else}
        {#each items as item, i (i + item)}
          <path
            d={slicePath(i)}
            class="{fillCls(i)} stroke-stone-300"
            stroke-width="0.5"
          />
          <text
            transform="rotate({(i + 0.5) * slice - 90} {C} {C})"
            x={SIZE - 12}
            y={C}
            text-anchor="end"
            dominant-baseline="middle"
            font-size={fontSize}
            font-weight="600"
            class="fill-stone-800">{label(item)}</text
          >
        {/each}
      {/if}
      {#if n >= 2}
        <circle cx={C} cy={C} r="8" class="fill-stone-50 stroke-stone-300" />
        <circle cx={C} cy={C} r="3" class="fill-brand" />
      {/if}
    </svg>
  </div>
</div>
