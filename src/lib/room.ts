export type RoomStatus = "lobby" | "voting" | "done";
/** vote = โหวตเลือก 1 อย่าง / swipe = ปัดซ้าย-ขวาทีละใบ */
export type RoomMode = "vote" | "swipe";

export type Room = {
  id: string;
  code: string;
  mode: RoomMode;
  category: string;
  status: RoomStatus;
  winner: string | null;
  host_id: string;
  created_at: string;
  expires_at: string;
};

export type Option = {
  id: string;
  room_id: string;
  title: string;
  added_by: string;
  created_at: string;
};

export type Vote = {
  room_id: string;
  voter_id: string;
  option_id: string;
  voter_name: string | null;
};

export type Swipe = {
  room_id: string;
  voter_id: string;
  option_id: string;
  liked: boolean;
  voter_name: string | null;
};

/** ข้อมูลที่ broadcast ผ่าน Realtime Presence */
export type Member = {
  id: string;
  name: string;
  ready: boolean;
  at: number;
};

// ---------- เพดานการใช้งาน (ต้องตรงกับ supabase/limits.sql) ----------
export const MAX_OPTIONS = 30;
export const MAX_MEMBERS = 10;

/** แปลง error จากฐานข้อมูล (LIMIT_*) เป็นข้อความไทย — คืน null ถ้าไม่ใช่ error เรื่องเพดาน */
export function limitMessage(message?: string): string | null {
  if (!message) return null;
  if (message.includes("LIMIT_OPTIONS")) return `ตัวเลือกเต็มแล้ว (สูงสุด ${MAX_OPTIONS} ตัว)`;
  if (message.includes("LIMIT_MEMBERS")) return `ห้องเต็มแล้ว (สูงสุด ${MAX_MEMBERS} คน)`;
  if (message.includes("LIMIT_ROOMS")) return "คุณเปิดห้องไว้เยอะเกินไป ใช้ห้องเดิมหรือรอให้ห้องเก่าหมดอายุก่อนนะ";
  if (message.includes("LIMIT_RATE")) return "สร้างห้องถี่เกินไป รอสักครู่แล้วลองใหม่นะ";
  return null;
}

// ตัดตัวอักษรที่สับสนง่าย (0/O, 1/I/L)
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomInt(max: number) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return Math.floor((buf[0] / 2 ** 32) * max);
}

export function makeCode(length = 5) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export function normalizeCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}
