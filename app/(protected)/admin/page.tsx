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
    // 0536: 구 max-w-3xl(768)은 0149 도입 — 커밋·회고에 폭 판정 기록 없음(근거 없음 판정).
    //   입출력 화면 공용 --reading-w(860)로 편입. 내부는 카드+행 목록이라 +92px에 고정 요소 없음.
    // 0573: 색 토큰 이전 — 이 화면만 0524~0527 이전에서 빠져 다크에서 글자가 안 읽혔다
    //   (#1A1A1A 본문이 glass-outer 합성면 위에서 대비 ≈1.3:1). 매핑은 다른 화면의 같은 역할을
    //   따른다: 본문 fg / 보조 제목·라벨 fg2 / 메타 muted / 한 단 옅은 층 hint / 행 구분선 hairline
    //   / 눈썹 primary(PlanFinderHeader·StoryHeader 0441과 같은 자리).
    //   **glass-outer는 유지** — 폐기된 유틸이 아니다(랜딩·auth·my-story 빈 상태가 계속 쓴다).
    //   0513·0527의 "카드 제거"는 플랜 상세·작성 한정이고 대체물은 다른 유틸이 아니라
    //   개방 캔버스(조판 변경)였다. 이번은 색·유틸 전환만이라 면은 손대지 않는다.
    <div className="max-w-[var(--reading-w)] mx-auto space-y-8">
      <div>
        <p className="text-xs font-semibold text-primary mb-1">Admin</p>
        <h1 className="text-2xl md:text-3xl font-bold text-fg">작품 관리</h1>
      </div>

      <section className="glass-outer divide-y divide-hairline">
        <div className="p-6">
          <h2 className="text-sm font-semibold text-fg2">
            승인 대기 <span className="text-hint">({pending.length})</span>
          </h2>
        </div>
        {pendingWithCandidates.length === 0 ? (
          <p className="p-6 text-sm text-muted">대기 중인 작품이 없습니다</p>
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

      <section className="glass-outer divide-y divide-hairline">
        <div className="p-6">
          <h2 className="text-sm font-semibold text-fg2">
            승인됨 <span className="text-hint">({approved.length})</span>
          </h2>
        </div>
        {approved.length === 0 ? (
          <p className="p-6 text-sm text-muted">승인된 작품이 없습니다</p>
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
