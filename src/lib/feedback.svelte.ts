// เสียง (Web Audio สังเคราะห์เอง ไม่ต้องมีไฟล์เสียง) + การสั่น (Vibration API)
// หมายเหตุ: iOS Safari ไม่รองรับ navigator.vibrate — จะมีแค่เสียง

const KEY = "laewtae:feedback";

let enabled = $state(true);
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function beep(freq: number, duration = 0.08, delay = 0, gain = 0.07, type: OscillatorType = "sine") {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // ค่อย ๆ เฟดเข้า-ออก กันเสียงแตก
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ไม่รองรับ */
    }
  }
}

export const feedback = {
  get enabled() {
    return enabled;
  },
  setEnabled(v: boolean) {
    enabled = v;
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* ไม่เป็นไร */
    }
    if (v) this.tap(); // ให้ลองฟังทันที
  },
  init() {
    try {
      enabled = localStorage.getItem(KEY) !== "0";
    } catch {
      /* ใช้ค่าเริ่มต้น */
    }
  },

  /** แตะ / กดพร้อม / มีคนโหวต */
  tap() {
    if (!enabled) return;
    beep(660, 0.05);
    vibrate(10);
  },
  /** โหวตของตัวเอง */
  vote() {
    if (!enabled) return;
    beep(520, 0.06);
    beep(780, 0.09, 0.06);
    vibrate(15);
  },
  /** เริ่มโหวต / เริ่มหมุน */
  start() {
    if (!enabled) return;
    beep(440, 0.08);
    beep(587, 0.1, 0.08);
    vibrate([20, 30, 20]);
  },
  /** วงล้อหยุด / ประกาศผล */
  win() {
    if (!enabled) return;
    [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.16, i * 0.09, 0.07, "triangle"));
    vibrate([30, 40, 70]);
  },
};
