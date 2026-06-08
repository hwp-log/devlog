export function calcPlanTotal(
  costs: { amount: number }[],
  flight?: { totalAmount: number } | null
): number {
  return costs.reduce((s, c) => s + c.amount, 0) + (flight?.totalAmount ?? 0);
}
