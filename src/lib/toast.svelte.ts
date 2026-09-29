type Toast = { id: number; message: string };

let toasts = $state<Toast[]>([]);
let seq = 0;

export const toast = {
  get list() {
    return toasts;
  },
  show(message: string, ms = 2400) {
    const id = ++seq;
    toasts = [...toasts, { id, message }];
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, ms);
  },
};
