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

  // มินิมอล: สลับขาว / เทาอ่อน (ชิ้นสุดท้ายไม่ซ้ำสีกับชิ้นแรกเมื่อจำนวนคี่)
  function fill(i: number) {
    if (n > 1 && n % 2 === 1 && i === n - 1) return "#e7e5e4";
    return i % 2 === 0 ? "#ffffff" : "#f5f5f4";
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

  export function spin() {
    if (spinning || n < 2) return;
    spinning = true;

    const winner = Math.floor(randomFloat() * n);
    pendingIndex = winner;

    // เข็มอยู่ด้านบน: มุมของวงล้อที่เข็มชี้ = (360 - rotation) mod 360
    const center = (winner + 0.5) * slice;
    const jitter = (randomFloat() - 0.5) * slice * 0.7;
    const base = Math.ceil(rotation / 360) * 360;
    rotation = base + 360 * 6 + (360 - center) + jitter;
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
        fill="#ff6b35"
        stroke="#fafaf9"
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
          fill="#44403c">เพิ่มตัวเลือกก่อนนะ</text
        >
      {:else if n === 1}
        <text
          x={C}
          y={C}
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="11"
          font-weight="600"
          fill="#1c1917">{label(items[0])}</text
        >
      {:else}
        {#each items as item, i (i + item)}
          <path
            d={slicePath(i)}
            fill={fill(i)}
            stroke="#d6d3d1"
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
            fill="#292524">{label(item)}</text
          >
        {/each}
      {/if}
      {#if n >= 2}
        <circle cx={C} cy={C} r="8" fill="#fafaf9" stroke="#d6d3d1" />
        <circle cx={C} cy={C} r="3" fill="#ff6b35" />
      {/if}
    </svg>
  </div>
</div>
