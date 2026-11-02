// How a faculty's campus area looks from its last 30 days of recycling.
export function growthFor(f) {
  const points = Number(f?.points_30d) || 0;
  const wrong = Number(f?.wrong_items_30d) || 0;
  const rate = Math.min(1, Math.max(0, Number(f?.correct_rate_30d) || 0));
  return {
    trees: Math.min(12, Math.floor(points / 40)),
    treeScale: Math.round((0.7 + 0.6 * rate) * 100) / 100,
    litter: Math.min(4, Math.floor(wrong / 10)),
  };
}
