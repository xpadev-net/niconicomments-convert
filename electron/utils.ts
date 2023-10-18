function base64ToUint8Array(base64Str: string): Uint8Array {
  const raw = Array.from(atob(base64Str));
  return Uint8Array.from(raw.map((x) => x.charCodeAt(0)));
}

const sleep = (time: number): Promise<void> => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
};

export { base64ToUint8Array, sleep };
