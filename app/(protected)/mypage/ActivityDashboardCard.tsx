interface Props {
  storyCount: number;
  planCount: number;
  likeCount: number;
  avgWon: number | null;
}

export function ActivityDashboardCard({ storyCount, planCount, likeCount, avgWon }: Props) {
  const items = [
    { label: '스토리', value: `${storyCount}` },
    { label: '계획', value: `${planCount}` },
    { label: '받은 좋아요', value: `${likeCount}` },
    { label: '평균 예산', value: avgWon !== null ? `${avgWon.toLocaleString()}만원` : '-' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">내 활동</h2>
      <div className="grid grid-cols-2 gap-4">
        {items.map((it) => (
          <div key={it.label}>
            <p className="text-xs font-semibold text-slate-500 mb-1">{it.label}</p>
            <p className="text-lg font-bold text-[#1A1A1A]">{it.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
