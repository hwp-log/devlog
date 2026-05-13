import { getTilStreak } from '@/lib/til/actions';

export default async function StreakWidget() {
  const result = await getTilStreak();

  if ('error' in result) {
    return (
      <div className="rounded-lg border border-slate-200 p-4">
        <p className="text-sm text-slate-500">통계를 불러오지 못했습니다</p>
      </div>
    );
  }

  const { currentStreak, bestStreak } = result.data;

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h2 className="text-sm font-medium text-slate-500 mb-2">연속 기록일</h2>
      <p className="text-4xl font-bold text-slate-900">{currentStreak}일</p>
      <p className="text-sm text-slate-400 mt-1">최고 {bestStreak}일</p>
    </div>
  );
}
