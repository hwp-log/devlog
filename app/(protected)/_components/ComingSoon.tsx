type ComingSoonProps = {
  title: string;
  description: string;
};

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <div
        className="rounded-2xl px-10 py-12 flex flex-col items-center gap-4 text-center"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '0.5px solid rgba(0,0,0,0.06)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
        }}
      >
        <p className="text-4xl">🔜</p>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">{title}</h1>
        <p className="text-sm text-slate-500">{description}</p>
        <p className="text-xs text-slate-400">곧 만나요</p>
      </div>
    </div>
  );
}
