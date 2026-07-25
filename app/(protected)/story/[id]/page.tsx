import Link from 'next/link';
import type { LocalSpot } from '@/lib/types';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { DeleteButton } from './DeleteButton';
import { LikeButton } from './LikeButton';
import SpotMap from '@/components/SpotMapWrapper';
import { ArrowRight } from 'lucide-react';
import { summarizePlanCost } from '@/lib/plan/summarize-plan-cost';
import { PublicCostSection } from './PublicCostSection';
import { AuthorAvatar } from '@/components/AuthorAvatar';

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

  return (
    // 폭 단일 소스(0373 — 0321 일원화 방식): 860 = 글쓰기·수정과 동일 리터럴(0322 확정).
    // 옛 max-w-7xl 래퍼는 ProtectedMain(max-w-7xl px-6)과 중복이라 제거, max-w-4xl(896)은 860으로 정합.
    <div className="max-w-[860px] mx-auto">
      {/* 본문 카드 제거(0371 — READ 블록 1단계): 읽기 표면은 페이지 배경 위 개방 캔버스(0319의
          상세판), 카드는 조작 표면(지도·목록)에만. 글쓰기 화면과 동일 문법.
          하드코딩 색 백로그는 0375(h1 text-fg)·0377(목록 링크 → primary 버튼)로 전부 해소 — 이 페이지 잔재 0 */}
      <div>
          {/* STORY 눈썹(0375) — PLAN·SPOTMAP과 동일 문법으로 상세 눈썹 3종 정렬. 헤드라인 없음
              (읽는 화면엔 안내할 행동이 없고 제목이 곧 타이틀), 작품 등 분류 데이터 없음
              (미연결 글 57% 실측 — 빈 상태가 기본이 되는 데이터는 눈썹 자리에 부적합).
              눈썹↔제목 간격 = 편집 화면 눈썹↔타이틀과 같은 6px 어휘(mt-[6px]) */}
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">STORY</p>
          <div className="flex items-start justify-between gap-4 mt-[6px] mb-6">
            {/* text-fg(0375) — #1A1A1A 하드코딩이 다크에서 제목만 안 뒤집히던 원인(사용자 실측) */}
            <h1 className="text-3xl font-bold text-fg leading-tight">{story.title}</h1>
            {isOwner && (
              // 텍스트 링크화(0372, 시안 실측) — 수정 primary(시안 accent=#4c9aff ≈ primary 매핑,
              // 프로젝트 accent는 별점 전용이라 오용 금지) / 삭제 muted. pt-[6px] = 제목과 flex-start 정렬 보정
              <div className="flex items-center gap-[14px] shrink-0 pt-[6px]">
                <Link
                  href={`/story/${story.id}/edit`}
                  className="text-[13px] font-medium text-primary hover:underline transition-colors"
                >
                  수정
                </Link>
                <DeleteButton storyId={story.id} />
              </div>
            )}
          </div>
          {/* 메타(0375 확정): 아바타 → 이름(fg2 — 날짜보다 한 단 진하게, 주체 강조) → 세로
              파이프(문자 아닌 1px 선, h-[11px], border 토큰) → 날짜. 요소 간 10px, 아바타↔이름은
              그룹 내 8px 유지. 날짜 모노 제거 — 0372의 Geist Mono는 한글 날짜 맥락에서 자간이
              벌어져 되돌림(트리맵 %·좋아요 숫자 등 숫자 지표의 모노는 유지).
              pb-[16px]+border-b = 헤더(제목·메타)와 본문 분리선 */}
          <div className="mt-[14px] flex items-center gap-[10px] text-[13px] font-medium text-muted pb-[16px] border-b border-border mb-6">
            <span className="flex items-center gap-2 text-fg2">
              <AuthorAvatar size="sm" nickname={story.user.nickname} avatarUrl={story.user.avatarUrl} />
              {story.user.nickname}
            </span>
            <span aria-hidden className="w-px h-[11px] bg-border" />
            <span>{story.createdAt.toLocaleDateString('ko-KR')}</span>
          </div>
          <div
            className="tiptap-content text-base leading-relaxed mb-6"
            dangerouslySetInnerHTML={{ __html: story.content }}
          />
          {/* 태그·좋아요 한 줄 양끝(0372 시안): 본문 종결선(border-t) 아래. 태그 div는 0개여도
              빈 채 렌더 — justify-between에서 좋아요 우측 고정 유지. slate 칩 → surface2+border 토큰 */}
          <div className="mt-[36px] pt-[20px] border-t border-border flex items-center justify-between gap-4">
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
      </div>
      {/* 블록 순서(0374): PLAN → 방문장소 — 편집·수정 화면과 동일 순서(WYSIWYG, 0349~0350 통일의
          잔여 항목). 두 블록 다 자체 mt-[46px] 조건부라 어느 쪽이 빠져도 간격 규칙 불변. */}
      {/* PLAN 블록 — 타이틀 = 플랜 제목 겸 링크(본문색·→ 아이콘), 하단 "이 여행플랜 보기" 링크를 대체.
          총액 0이어도 눈썹+제목 링크는 유지(플랜 경로 보존 — 옛 하단 링크도 총액 무관이었음),
          트리맵만 ratios 있을 때 렌더. BUDGET(예산을 약속하는 헤더)과 달리 PLAN 타이틀은
          플랜 제목 자체가 정보이자 링크라 단독 성립 — 0343 "헤더만 뜬다"류 문제 아님. */}
      {story.plan && publicSummary && (
        <div className="mt-[46px]">
          {/* 눈썹 클래스 = 0342 SPOTMAP 눈썹과 동일 문자열. 공용 <Eyebrow> 추출은 후속 정리 */}
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">PLAN</p>
          {/* h2 mb: 소개 표시 시 10px(제목↔소개), 소개가 자기 mb-[16px]로 트리맵 간격을 이어받음.
              소개 미표시(비공개·빈 값) 시 기존 16px — 음수 마진 상쇄 대신 명시 분기(값 의도 보존). */}
          <h2 className={`text-[20px] font-bold tracking-[-0.02em] text-fg mt-[6px] ${story.plan.isPublic && story.plan.description ? 'mb-[10px]' : 'mb-[16px]'} break-keep`}>
            {story.plan.isPublic && story.planId ? (
              // 비공개 플랜은 plan-finder 상세가 없어 링크 미제공(기존 하단 링크의 isPublic 조건 승계)
              <Link
                href={`/plan-finder/${story.planId}`}
                className="inline-flex items-center gap-1 hover:text-fg2 transition-colors"
              >
                {story.plan.title}
                <ArrowRight size={18} aria-hidden />
              </Link>
            ) : (
              story.plan.title
            )}
          </h2>
          {/* 소개 — 비공개 플랜 미표시(링크 미제공과 같은 isPublic 조건). 상한 없는 필드라 2줄 클램프 */}
          {story.plan.isPublic && story.plan.description && (
            <p className="mb-[16px] text-[13px] leading-[1.6] text-fg2 line-clamp-2">{story.plan.description}</p>
          )}
          {publicSummary.ratios.length > 0 && <PublicCostSection summary={publicSummary} />}
        </div>
      )}
      {story.storySpots.length > 0 && (
        // mt-[46px](0371) — 시안 섹션 리듬 46px, 글쓰기 필드 블록 리듬(pt-[46px], 0357)과 통일.
        // 카드 하단 패딩 32px 소실분 승계(기존 32+24 → 46)
        <div className="mt-[46px]">
          {/* 눈썹 문법(0375) — 같은 화면 PLAN 블록·편집 화면(0342 SPOTMAP)과 동일 클래스 문자열.
              MapPin 아이콘 제거 — 눈썹+타이틀 구조로 통일 */}
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">SPOTMAP</p>
          <h2 className="text-[20px] font-bold tracking-[-0.02em] text-fg mt-[6px] mb-[16px] break-keep">방문장소</h2>
          {/* fixedSideWidth(0376) — 0373 폭 정합(상세도 860)으로 "상세=비율" 분기의 전제가 소멸,
              글수정과 동일 크기(카드 426/지도 422)로 통일 */}
          <SpotMap spots={localSpots} readOnly fixedSideWidth />
        </div>
      )}
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
