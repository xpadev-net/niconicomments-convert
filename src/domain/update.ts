// Compares dotted numeric versions such as "0.0.34" or "v1.2". Returns
// undefined when either side is not a plain numeric version.
const parseVersion = (value: string): number[] | undefined => {
  const match = /^v?(\d+(?:\.\d+)*)$/.exec(value.trim());
  return match ? match[1].split(".").map(Number) : undefined;
};

const isNewerVersion = (latest: string, current: string): boolean => {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
};

export { isNewerVersion };
