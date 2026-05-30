export function getSpotColor(index: number, total: number): string {
  if (total === 1) return '#0ea5e9';
  if (index === 0) return '#22c55e';
  if (index === total - 1) return '#ef4444';
  return '#0ea5e9';
}
