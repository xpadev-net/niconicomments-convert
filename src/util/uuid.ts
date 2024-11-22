import type { UUID } from "@/@types/brand";

function uuid(): UUID {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (a) => {
    const r = ((new Date().getTime() + Math.random() * 16) % 16) | 0;
    const v = a === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }) as UUID;
}
export { uuid };
