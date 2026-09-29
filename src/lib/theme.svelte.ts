// ธีม light / dark: ค่าเริ่มต้นตามระบบ, ผู้ใช้กดสลับเองได้ และจำค่าไว้ในเครื่อง
// (สคริปต์ใน app.html ตั้ง data-theme ให้ก่อนหน้าเว็บโหลดเสร็จ ที่นี่แค่ซิงก์ state + จัดการตอนกดสลับ)

type Theme = "light" | "dark";

const KEY = "laewtae:theme";
const COLORS: Record<Theme, string> = { light: "#fafaf9", dark: "#1a1716" };

let current = $state<Theme>("light");

function saved(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function apply(t: Theme) {
  current = t;
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = COLORS[t];
}

export const theme = {
  get current() {
    return current;
  },

  init() {
    const media = matchMedia("(prefers-color-scheme: dark)");
    apply(saved() ?? (media.matches ? "dark" : "light"));
    // ถ้ายังไม่เคยเลือกเอง → ตามระบบต่อไป (เช่น ระบบสลับเป็นมืดตอนกลางคืน)
    media.addEventListener("change", (e) => {
      if (!saved()) apply(e.matches ? "dark" : "light");
    });
  },

  toggle() {
    const next: Theme = current === "dark" ? "light" : "dark";
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* เก็บไม่ได้ก็ไม่เป็นไร */
    }
  },
};
