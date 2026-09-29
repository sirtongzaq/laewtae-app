// ประวัติในเครื่อง (ไม่ต้อง login และไม่เก็บลงฐานข้อมูล)
//  • ห้องล่าสุดที่เคยเข้า → กดกลับเข้าห้องเดิมได้
//  • ผลที่เคยได้ → ใช้ "ไม่สุ่มซ้ำภายใน N วัน"
// เก็บใน localStorage ของเบราว์เซอร์นี้ จึงไม่กินพื้นที่ Supabase เลย
// (ข้อจำกัด: ไม่ซิงก์ข้ามเครื่อง และหายเมื่อล้างข้อมูลเบราว์เซอร์)

export type ResultSource = "solo" | "vote" | "swipe";

export type ResultRecord = {
  title: string;
  category: string;
  at: number;
  source: ResultSource;
  /** กันบันทึกผลเดิมซ้ำ (เช่น รีเฟรชหน้าห้องที่จบแล้ว) */
  ref?: string;
  /** สุ่ม/ตัดสินจากตัวเลือกเหล่านี้ (ถ้ามี) */
  from?: string[];
  /** รหัสห้อง (โหมดโหวต/ปัด) */
  code?: string;
};

export type RoomRecord = {
  code: string;
  mode: "vote" | "swipe";
  category: string;
  /** เวลาหมดอายุของห้อง (ms) */
  expiresAt: number;
  lastSeen: number;
  winner: string | null;
};

const KEY = "laewtae:history:v1";
const MAX_RESULTS = 100;
const MAX_ROOMS = 10;
const DAY = 86_400_000;

let results = $state<ResultRecord[]>([]);
let rooms = $state<RoomRecord[]>([]);
let avoidDays = $state(0); // 0 = ปิด
let loaded = false;

function save() {
  if (!loaded) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ results, rooms, avoidDays }));
  } catch {
    /* เก็บไม่ได้ก็ไม่เป็นไร */
  }
}

export const recents = {
  get results() {
    return results;
  },
  /** ห้องที่ยังไม่หมดอายุ (ใหม่สุดก่อน) */
  get rooms() {
    return rooms.filter((r) => r.expiresAt > Date.now());
  },
  get avoidDays() {
    return avoidDays;
  },

  init() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (saved) {
        results = Array.isArray(saved.results) ? saved.results : [];
        rooms = Array.isArray(saved.rooms) ? saved.rooms : [];
        avoidDays = [0, 3, 7, 14].includes(saved.avoidDays) ? saved.avoidDays : 0;
      }
    } catch {
      /* เริ่มใหม่ */
    }
    loaded = true;
    // ทิ้งห้องที่หมดอายุไปนานแล้ว
    rooms = rooms.filter((r) => r.expiresAt > Date.now() - DAY);
    save();
  },

  setAvoidDays(n: number) {
    avoidDays = n;
    save();
  },

  addResult(r: Omit<ResultRecord, "at">) {
    if (r.ref && results.slice(0, 20).some((x) => x.ref === r.ref)) return;
    results = [{ ...r, at: Date.now() }, ...results].slice(0, MAX_RESULTS);
    save();
  },

  /** ชื่อที่เพิ่งเป็นผู้ชนะภายใน N วันล่าสุด (ว่างถ้าปิดการใช้งาน) */
  recentTitles(): Set<string> {
    if (avoidDays <= 0) return new Set();
    const since = Date.now() - avoidDays * DAY;
    return new Set(results.filter((r) => r.at >= since).map((r) => r.title));
  },

  touchRoom(r: Omit<RoomRecord, "lastSeen">) {
    rooms = [{ ...r, lastSeen: Date.now() }, ...rooms.filter((x) => x.code !== r.code)].slice(
      0,
      MAX_ROOMS,
    );
    save();
  },

  forgetRoom(code: string) {
    rooms = rooms.filter((r) => r.code !== code);
    save();
  },

  removeResult(at: number, title: string) {
    results = results.filter((r) => !(r.at === at && r.title === title));
    save();
  },

  clear() {
    results = [];
    rooms = [];
    save();
  },
};

/** "เมื่อ 5 นาทีที่แล้ว" */
export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "เมื่อสักครู่";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}
