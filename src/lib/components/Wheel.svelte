<script lang="ts">
  type Props = {
    items: string[];
    onresult?: (item: string, index: number) => void;
  };

  let { items, onresult }: Props = $props();

  const COLORS = [
    "#ff6b35",
    "#f7b32b",
    "#2ec4b6",
    "#e71d36",
    "#5fa8d3",
    "#8ac926",
    "#9b5de5",
    "#ff8fab",
  ];

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

  function color(i: number) {
    // ไม่ให้สีชิ้นสุดท้ายซ้ำกับชิ้นแรก
    if (n > 1 && i === n - 1 && i % COLORS.length === 0) return COLORS[1];
    return COLORS[i % COLORS.length];
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
    const jitter = (randomFloat() - 0.5) * slice * 0.7; // สุ่มตำแหน่งในชิ้น ไม่ให้ชี้กลางเป๊ะ
    const base = Math.ceil(rotation / 360) * 360;
    rotation = base + 360 * 6 + (360 - center) + jitter;
  }

  function onEnd(e: TransitionEvent) {
    if (e.propertyName !== "transform" || !spinning) return;
    spinning = false;
    if (pendingIndex >= 0) onresult?.(items[pendingIndex], pendingIndex);
  }
</script>

<div class="relative mx-auto aspect-square w-full max-w-sm select-none">
  <!-- เข็มชี้ -->
  <div
    class="absolute top-0 left-1/2 z-10 -translate-x-1/2 -translate-y-1"
    aria-hidden="true"
  >
    <svg width="34" height="40" viewBox="0 0 34 40">
      <path
        d="M17 40 L2 8 Q17 -4 32 8 Z"
        fill="#1e293b"
        stroke="white"
        stroke-width="3"
      />
    </svg>
  </div>

  <div
    class="h-full w-full rounded-full shadow-xl ring-8 ring-white"
    style="transform: rotate({rotation}deg); transition: transform {spinning
      ? 5
      : 0}s cubic-bezier(0.12, 0.6, 0.1, 1);"
    ontransitionend={onEnd}
  >
    <svg viewBox="0 0 {SIZE} {SIZE}" class="h-full w-full">
      {#if n === 0}
        <circle cx={C} cy={C} r={C} fill="#e2e8f0" />
        <text
          x={C}
          y={C}
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="9"
          fill="#64748b">เพิ่มตัวเลือกก่อนนะ</text
        >
      {:else if n === 1}
        <circle cx={C} cy={C} r={C} fill={COLORS[0]} />
        <text
          x={C}
          y={C}
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="11"
          font-weight="700"
          fill="white">{label(items[0])}</text
        >
      {:else}
        {#each items as item, i (i + item)}
          <path
            d={slicePath(i)}
            fill={color(i)}
            stroke="white"
            stroke-width="0.8"
          />
          <text
            transform="rotate({(i + 0.5) * slice - 90} {C} {C})"
            x={SIZE - 10}
            y={C}
            text-anchor="end"
            dominant-baseline="middle"
            font-size={fontSize}
            font-weight="700"
            fill="white">{label(item)}</text
          >
        {/each}
      {/if}
      <circle cx={C} cy={C} r="9" fill="white" />
      <circle cx={C} cy={C} r="4" fill="#1e293b" />
    </svg>
  </div>
</div>
