export function DangerZoneCard() {
  return (
    <div className="p-6 space-y-3">
      <h2 className="text-sm font-semibold text-rose-500">위험 구역</h2>
      <p className="text-xs text-slate-500">회원 탈퇴는 준비 중입니다.</p>
      <button
        type="button"
        disabled
        className="btn-elevated px-4 py-2 text-sm text-rose-500 disabled:opacity-50 cursor-not-allowed"
      >
        회원 탈퇴
      </button>
    </div>
  );
}
