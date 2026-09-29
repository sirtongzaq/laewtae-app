type Toast = { id: number; message: string };

let toasts = $state<Toast[]>([]);
let seq = 0;

export const toast = {
  get list() {
    return toasts;
  },

  /** แสดง toast แล้วคืน id — ms = 0 คือค้างไว้จนกว่าจะ dismiss เอง (ใช้กับนับถอยหลัง) */
  show(message: string, ms = 2400) {
    const id = ++seq;
    toasts = [...toasts, { id, message }];
    if (ms > 0) setTimeout(() => this.dismiss(id), ms);
    return id;
  },

  /** เปลี่ยนข้อความของ toast ที่แสดงอยู่ */
  update(id: number, message: string) {
    toasts = toasts.map((t) => (t.id === id ? { ...t, message } : t));
  },

  dismiss(id: number) {
    toasts = toasts.filter((t) => t.id !== id);
  },
};
