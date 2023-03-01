function base64ToUint8Array(base64Str: string) {
  const raw = atob(base64Str);
  return Uint8Array.from(
    Array.prototype.map.call(raw, (x: string) => {
      return x.charCodeAt(0);
    })
  );
}
export { base64ToUint8Array };
