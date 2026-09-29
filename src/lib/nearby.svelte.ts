// ค้นหาร้านใกล้ตัวด้วยลิงก์ Google Maps (ไม่ใช้ API ไม่มีค่าใช้จ่าย)
//
// 2 ระดับ:
//  1) ค่าเริ่มต้น: ค้นด้วยข้อความ "<ชื่อ> near me" — Google Maps ใช้ตำแหน่งของเครื่องเอง
//     เราไม่ต้องขอสิทธิ์และไม่เห็นตำแหน่งของผู้ใช้เลย
//  2) ถ้าผู้ใช้กดอนุญาตตำแหน่ง → ใส่พิกัดลงในลิงก์ให้แม่นขึ้น
//     พิกัดเก็บในหน่วยความจำของหน้านี้เท่านั้น ไม่บันทึกและไม่ส่งไปที่ไหน

import { toast } from "$lib/toast.svelte";

type Coords = { lat: number; lng: number };

let coords = $state<Coords | null>(null);
let asking = $state(false);

const supported = () => typeof navigator !== "undefined" && "geolocation" in navigator;

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 5 * 60_000,
    }),
  );
}

export const nearby = {
  get coords() {
    return coords;
  },
  get asking() {
    return asking;
  },
  get supported() {
    return supported();
  },

  /** ถ้าเคยอนุญาตตำแหน่งไว้แล้ว ดึงให้เงียบ ๆ (ไม่มี popup ขออนุญาต) */
  async init() {
    try {
      if (!supported() || !navigator.permissions) return;
      const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      if (status.state === "granted") await this.request(true);
    } catch {
      /* ไม่รองรับ ก็ใช้แบบข้อความ */
    }
  },

  /** ขอตำแหน่งปัจจุบัน (เรียกจากการกดปุ่มของผู้ใช้) */
  async request(silent = false) {
    if (!supported() || asking) return false;
    asking = true;
    try {
      const p = await position();
      coords = { lat: p.coords.latitude, lng: p.coords.longitude };
      if (!silent) toast.show("ได้ตำแหน่งแล้ว ค้นหาแม่นขึ้นเลย");
      return true;
    } catch {
      if (!silent) toast.show("ขอตำแหน่งไม่ได้ ใช้ปุ่มค้นหา “ใกล้ตัว” แบบปกติได้เลย");
      return false;
    } finally {
      asking = false;
    }
  },

  /** ลิงก์ค้นหาใน Google Maps */
  url(query: string) {
    if (coords) {
      return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${coords.lat.toFixed(5)},${coords.lng.toFixed(5)},15z`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query} near me`)}`;
  },
};
