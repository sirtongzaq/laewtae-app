export type RoomStatus = "lobby" | "voting" | "done";

export type Room = {
  id: string;
  code: string;
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

/** ข้อมูลที่ broadcast ผ่าน Realtime Presence */
export type Member = {
  id: string;
  name: string;
  ready: boolean;
  at: number;
};

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
