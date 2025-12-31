export function maskSecret(value?: string | null, visible = 2) {
  if (!value) return "—";
  if (value.length <= visible * 2) return "•".repeat(value.length);
  const prefix = value.slice(0, visible);
  const suffix = value.slice(-visible);
  return `${prefix}${"•".repeat(value.length - visible * 2)}${suffix}`;
}
