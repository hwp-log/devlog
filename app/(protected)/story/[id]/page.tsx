import Link from 'next/link';
import Image from 'next/image';
import type { LocalSpot } from '@/lib/types';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { DeleteButton } from './DeleteButton';
import { LikeButton } from './LikeButton';
import SpotMap from '@/components/SpotMapWrapper';
import { summarizePlanCost } from '@/lib/plan/summarize-plan-cost';
import { buildPlanSummaryLine } from '@/lib/plan/summary-line';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { SquarePen } from 'lucide-react';
import { BTN_ICON_CHIP } from '@/lib/button-styles';

export default async function StoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  const [story, myLike] = await Promise.all([
    prisma.story.findUnique({
      where: { id },
      include: {
        tags: true,
        // S2 미전환분 수정: story_spots 조인 기준 (S3-a 재사용 스팟은 owned Spot이 없어 story.spots로는 안 잡힘).
        storySpots: {
          orderBy: { order: 'asc' },
          select: {
            order: true, review: true, photoUrl: true, rating: true,
            // 작품은 spot_movies 조인(복수) — 레거시 spot.movie(단수)는 재사용 seed 스팟에서 null이라 누락됨.
            spot: { include: { spotMovies: { orderBy: { createdAt: 'desc' }, select: { movie: { select: { id: true, title: true } } } } } },
          },
        },
        plan: {
          select: {
            title: true,
            description: true,
            isPublic: true,
            currency: true,
            coverUrl: true,
            // 요약 한 줄(일수·스팟·인원) 소스 — plan-finder fetchPublicPlans와 동일 방식
            startDate: true,
            endDate: true,
            headcount: true,
            _count: { select: { spots: true } },
            costs: { select: { category: true, amount: true } },
            flight: { select: { totalAmount: true } },
          },
        },
        _count: { select: { likes: true } },
        user: { select: { nickname: true, avatarUrl: true } },
      },
    }),
    currentUser
      ? prisma.like.findUnique({
          where: { storyId_userId: { storyId: id, userId: currentUser.id } },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (!story) notFound();

  // per-visit(order/review/photoUrl/rating)은 story_spot 조인에서, per-place(name/좌표/작품/주소)는 spot에서.
  // 작품: spot_movies 최신 연결순(0185 대표 규칙) → 대표 1개 + extraMovieCount("+N"). SpotFinder와 동일 정책.
  const localSpots: LocalSpot[] = story.storySpots.map((ss) => {
    const movies = ss.spot.spotMovies.map((sm) => sm.movie);
    return {
      id: ss.spot.id, name: ss.spot.name, lat: ss.spot.lat, lng: ss.spot.lng, order: ss.order,
      photoUrl: ss.photoUrl, review: ss.review, address: ss.spot.address, description: ss.spot.description,
      movieId: movies[0]?.id ?? null,
      movieTitle: movies[0]?.title ?? null,
      extraMovieCount: Math.max(0, movies.length - 1),
      rating: ss.rating ?? null,
    };
  });

  const isOwner = currentUser?.id === story.userId;

  const publicSummary = story.plan
    ? summarizePlanCost(
        story.plan.costs,
        story.plan.flight,
        story.plan.currency as 'KRW' | 'USD' | 'JPY',
      )
    : null;

  // PLAN 카드 요약 한 줄 — 문구·게이트 규칙은 buildPlanSummaryLine(공용, 작성 화면과 단일 소스) 주석 참조
  const planSummaryLine = story.plan
    ? buildPlanSummaryLine({
        startDate: story.plan.startDate,
        endDate: story.plan.endDate,
        spotCount: story.plan._count.spots,
        headcount: story.plan.headcount,
        showCost: story.plan.isPublic,
        band: publicSummary?.band ?? null,
      })
    : '';

  return (
    // 폭 단일 소스(0373 — 0321 일원화 방식): 860 = 글쓰기·수정과 동일 리터럴(0322 확정).
    // 옛 max-w-7xl 래퍼는 ProtectedMain(max-w-7xl px-6)과 중복이라 제거, max-w-4xl(896)은 860으로 정합.
    <div className="max-w-[var(--story-content-w)] mx-auto">
      {/* 본문 카드 제거(0371 — READ 블록 1단계): 읽기 표면은 페이지 배경 위 개방 캔버스(0319의
          상세판), 카드는 조작 표면(지도·목록)에만. 글쓰기 화면과 동일 문법.
          하드코딩 색 백로그는 0375(h1 text-fg)·0377(목록 링크 → primary 버튼)로 전부 해소 — 이 페이지 잔재 0 */}
      <div>
          {/* STORY 눈썹(0375) — PLAN·SPOTMAP과 동일 문법으로 상세 눈썹 3종 정렬. 헤드라인 없음
              (읽는 화면엔 안내할 행동이 없고 제목이 곧 타이틀), 작품 등 분류 데이터 없음
              (미연결 글 57% 실측 — 빈 상태가 기본이 되는 데이터는 눈썹 자리에 부적합).
              눈썹↔제목 간격 = 편집 화면 눈썹↔타이틀과 같은 6px 어휘(mt-[6px]) */}
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">STORY</p>
          {/* 제목 행 = 제목 단독(0481) — 관리 액션은 메타 행 우측으로 이동(읽기 화면에서
              관리를 낮은 어휘로, 0452 결). 구 텍스트 링크화(0372)는 아이콘 테두리 어휘로 대체 */}
          <div className="mt-[6px] mb-6">
            {/* text-fg(0375) — #1A1A1A 하드코딩이 다크에서 제목만 안 뒤집히던 원인(사용자 실측).
                0523: 공통 척도 페이지 제목 28px/700 -0.02em(구 30px). 단일 값이라 모바일도
                30→28px 축소 — sm:로 쪼개면 모바일이 데스크톱보다 큰 역전이 생겨 전 구간 적용 */}
            <h1 className="text-[28px] font-bold tracking-[-0.02em] text-fg leading-tight">{story.title}</h1>
          </div>
          {/* 메타(0375 확정): 아바타 → 이름(fg2 — 날짜보다 한 단 진하게, 주체 강조) → 세로
              파이프(문자 아닌 1px 선, h-[11px], border 토큰) → 날짜. 요소 간 10px, 아바타↔이름은
              그룹 내 8px 유지. 날짜 모노 제거 — 0372의 Geist Mono는 한글 날짜 맥락에서 자간이
              벌어져 되돌림(트리맵 %·좋아요 숫자 등 숫자 지표의 모노는 유지).
              pb-[16px]+border-b = 헤더(제목·메타)와 본문 분리선 */}
          <div className="mt-[14px] flex items-center justify-between gap-4 pb-[16px] border-b border-border mb-6">
            {/* 0523: 공통 척도 보조 등급 14px(sm+). 모바일 13px은 유지 */}
            <div className="flex items-center gap-[10px] text-[13px] sm:text-sm font-medium text-muted">
              <span className="flex items-center gap-2 text-fg2">
                <AuthorAvatar size="sm" nickname={story.user.nickname} avatarUrl={story.user.avatarUrl} />
                {story.user.nickname}
              </span>
              <span aria-hidden className="w-px h-[11px] bg-border" />
              <span>{story.createdAt.toLocaleDateString('ko-KR')}</span>
            </div>
            {isOwner && (
              // 관리 아이콘(0481 최종) — surface2 칩 위 무채 글리프: 맨 글리프는 콜아웃·
              // 카드(회색 면)와 재질이 어긋나 콜아웃과 같은 면에 올림. 정지 무채(저빈도
              // 관리가 주의를 끌지 않게), 위험 신호는 삭제의 hover:text-danger로만
              // (의도 접근 시점, DeleteButton). 글리프 18px·히트 44px(before 확장)·
              // gap-3(히트 간 4px — 비가역 삭제 보호) 유지
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href={`/story/${story.id}/edit`}
                  aria-label="수정"
                  className={`${BTN_ICON_CHIP} text-fg2 hover:text-fg`}
                >
                  <SquarePen size={18} />
                </Link>
                <DeleteButton storyId={story.id} />
              </div>
            )}
          </div>
          <div
            className="tiptap-content text-base leading-relaxed mb-6"
            dangerouslySetInnerHTML={{ __html: story.content }}
          />
      </div>
      {/* 블록 순서: 방문계획(PLAN) → 방문장소(지도) — 블로그 후기 관행상 지도는 글 마지막
          (사용자 확정). 편집 화면도 0459에서 같은 순서로 정합(0387의 SPOTMAP→PLAN 폐기).
          두 블록 다 자체 mt-[46px] 조건부라 어느 쪽이 빠져도 간격 규칙 불변. */}
      {/* PLAN 카드 — 섹션 h2("방문계획") + 카드(면·테두리·radius 기존 토큰 어휘).
          카드 안 타이틀 = 플랜 제목 겸 링크(isPublic일 때만 — 비공개는 plan-finder 상세가
          없어 미제공). 트리맵은 요약 한 줄로 대체(0452). */}
      {/* 0557: 비공개 플랜 카드는 남에게 통째 생략(제목 포함) — "비공개 = 글 자체를 가림" 재정의.
          작성자 본인에겐 유지. 스토리 작성자 = 연결 플랜 소유자라 isOwner로 충분(렌더 게이트 — 조회 무변). */}
      {story.plan && publicSummary && (story.plan.isPublic || isOwner) && (
        <div className="mt-[46px]">
          {/* h2 클래스 = 방문장소 h2와 동일 문자열(섹션 제목 한 벌). 0523: 공통 척도 22px */}
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-fg mb-[16px] break-keep">방문계획</h2>
          <div className="rounded-[var(--radius-base)] bg-surface2 p-4">
            {/* 커버 미디어 오브젝트(0451) — 넓으면 좌 커버 140×105 + 우 텍스트, min-[480px] 미만은 세로 스택.
                coverUrl null 0건(실측)이나 방어로 있을 때만 렌더. */}
            <div className="flex flex-col min-[480px]:flex-row min-[480px]:items-start gap-4">
              {story.plan.coverUrl && (
                // radius = --radius-base(tiptap img와 동일 어휘). 커버 도메인은 PlanCard가 이미 쓰는 remotePatterns.
                <div className="relative w-full aspect-[4/3] min-[480px]:w-[140px] min-[480px]:h-[105px] min-[480px]:aspect-auto shrink-0 overflow-hidden rounded-[var(--radius-base)]">
                  <Image src={story.plan.coverUrl} alt="" fill sizes="(min-width: 480px) 140px, 100vw" className="object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {/* h3 — 섹션 h2("방문계획") 신설로 카드 내 제목은 한 단계 아래(위계 정정, 클래스 불변) */}
                <h3 className={`text-[20px] font-bold tracking-[-0.02em] text-fg ${story.plan.isPublic && story.plan.description ? 'mb-[10px]' : ''} break-keep`}>
                  {story.plan.isPublic && story.planId ? (
                    // 비공개 플랜은 plan-finder 상세가 없어 링크 미제공(기존 하단 링크의 isPublic 조건 승계).
                    // '→' 화살표 제거(글 톤 정리) — 링크 어포던스는 hover 명도 반응이 담당
                    <Link
                      href={`/plan-finder/${story.planId}`}
                      className="hover:text-fg2 transition-colors"
                    >
                      {story.plan.title}
                    </Link>
                  ) : (
                    story.plan.title
                  )}
                </h3>
                {/* 소개 — 비공개 플랜 미표시(링크 미제공과 같은 isPublic 조건). 상한 없는 필드라 2줄 클램프 */}
                {story.plan.isPublic && story.plan.description && (
                  <p className="text-[13px] sm:text-sm leading-[1.6] text-fg2 line-clamp-2">{story.plan.description}</p>
                )}
                {/* 요약 한 줄(트리맵 대체) — 소스·게이트 규칙은 planSummaryLine 파생부 주석 참조 */}
                {planSummaryLine && (
                  <p className="mt-[8px] text-[13px] sm:text-sm text-muted">{planSummaryLine}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {story.storySpots.length > 0 && (
        // mt-[46px](0371) — 시안 섹션 리듬 46px, 글쓰기 필드 블록 리듬(pt-[46px], 0357)과 통일.
        // 카드 하단 패딩 32px 소실분 승계(기존 32+24 → 46)
        <div className="mt-[46px]">
          {/* 눈썹 라벨 제거(글 톤 정리) — h2만 유지. mt-[6px]는 눈썹→h2 간격이었어서 함께 제거 */}
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-fg mb-[16px] break-keep">방문장소</h2>
          {/* fixedSideWidth(0376) — 0373 폭 정합(상세도 860)으로 "상세=비율" 분기의 전제가 소멸,
              글수정과 동일 크기(카드 426/지도 422)로 통일 */}
          <SpotMap spots={localSpots} readOnly fixedSideWidth />
        </div>
      )}
      {/* 태그·좋아요(0372) — 지도 뒤 페이지 마무리 행(글 흐름 유지). 구분선(border-t) 동반,
          상단 마진은 블록 리듬 46px(본문 직후 전제였던 36px 폐기).
          태그 div는 0개여도 빈 채 렌더 — justify-between에서 좋아요 우측 고정 유지 */}
      <div className="mt-[46px] pt-[20px] border-t border-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {story.tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/story?q=${encodeURIComponent(tag.name)}`}
              className="text-[12.5px] px-[12px] py-[5px] rounded-full bg-surface2 border border-border text-fg2 cursor-pointer hover:bg-popover transition-colors"
            >
              #{tag.name}
            </Link>
          ))}
        </div>
        <LikeButton
          storyId={story.id}
          initialLiked={!!myLike}
          initialCount={story._count.likes}
          isLoggedIn={!!currentUser}
        />
      </div>
      {/* 다른 이야기 보기(0377) — 다 읽은 독자의 다음 행동이 이 화면의 주요 행동: 글쓰기 "스토리
          등록"·수정 "수정"과 같은 위계 = 같은 클래스 문자열(StoryWriteForm 등록 버튼) + 같은
          46px 리듬(글쓰기도 등록 버튼 앞이 pt-[46px] — "마무리 버튼도 블록 리듬"의 기존 선례).
          화살표 없음(사용자 확정 — 텍스트만). 이 교체로 상세의 slate
          하드코딩 잔재 소멸 */}
      <div className="mt-[46px]">
        <Link
          href="/story"
          className="w-full bg-primary text-white rounded-full py-[13px] text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center"
        >
          다른 이야기 보기
        </Link>
      </div>
    </div>
  );
}
