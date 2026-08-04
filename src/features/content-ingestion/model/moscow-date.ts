export function toMoscowIsoOrOriginal(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
  const parsed = new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(withSeconds)
    ? withSeconds
    : `${withSeconds}+03:00`);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString();
}
