export function calcCostSummary(costs: { category: string; amount: number }[]) {
  const totals = { TRANSPORT: 0, ACCOMMODATION: 0, FOOD: 0, ENTRANCE: 0, ETC: 0 };
  for (const cost of costs) {
    if (cost.category in totals) {
      (totals as Record<string, number>)[cost.category] += cost.amount;
    }
  }
  return totals;
}
