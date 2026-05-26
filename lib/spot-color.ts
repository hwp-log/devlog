export function getSpotColor(index: number, total: number): string {
  if (total === 1) return '#16a34a';
  if (index === 0) return '#16a34a';
  if (index === total - 1) return '#dc2626';
  return '#0ea5e9';
}
