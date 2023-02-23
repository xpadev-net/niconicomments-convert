function base64ToUint8Array(base64Str: string) {
  const raw = Array.from(Buffer.from(base64Str, "base64").toString());
  return Uint8Array.from(raw.map((x: string) => x.charCodeAt(0)));
}
export { base64ToUint8Array };
