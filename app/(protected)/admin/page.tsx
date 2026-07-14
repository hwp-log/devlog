import { prisma } from '@/lib/prisma';
import { findMergeCandidates } from '@/lib/movie/queries';
import { PendingMovieRow } from './_components/PendingMovieRow';
import { ApprovedMovieRow } from './_components/ApprovedMovieRow';

export default async function AdminPage() {
  const [pending, approved] = await Promise.all([
    prisma.movie.findMany({
      where: { status: 'PENDING' },
      include: { _count: { select: { spotMovies: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.movie.findMany({
      where: { status: 'APPROVED' },
      include: { _count: { select: { spotMovies: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const pendingWithCandidates = await Promise.all(
    pending.map(async (m) => ({
      ...m,
      candidates: await findMergeCandidates(m.title, 3),
    })),
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <p className="text-xs font-semibold text-sky-500 mb-1">Admin</p>
        <h1 className="text-2xl md:text-3xl font-bold text-[#1A1A1A]">작품 관리</h1>
      </div>

      <section className="glass-outer divide-y divide-black/5">
        <div className="p-6">
          <h2 className="text-sm font-semibold text-slate-700">
            승인 대기 <span className="text-slate-400">({pending.length})</span>
          </h2>
        </div>
        {pendingWithCandidates.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">대기 중인 작품이 없습니다</p>
        ) : (
          pendingWithCandidates.map((m) => (
            <PendingMovieRow
              key={m.id}
              id={m.id}
              title={m.title}
              spotCount={m._count.spotMovies}
              createdAt={m.createdAt}
              candidates={m.candidates}
            />
          ))
        )}
      </section>

      <section className="glass-outer divide-y divide-black/5">
        <div className="p-6">
          <h2 className="text-sm font-semibold text-slate-700">
            승인됨 <span className="text-slate-400">({approved.length})</span>
          </h2>
        </div>
        {approved.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">승인된 작품이 없습니다</p>
        ) : (
          approved.map((m) => (
            <ApprovedMovieRow
              key={m.id}
              id={m.id}
              title={m.title}
              spotCount={m._count.spotMovies}
              createdAt={m.createdAt}
            />
          ))
        )}
      </section>
    </div>
  );
}
