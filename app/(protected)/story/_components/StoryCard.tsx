import Link from 'next/link';
import Image from 'next/image';
import { Heart, MapPin } from 'lucide-react';
import { formatStoryCardDate } from '@/lib/format-date';
import { CARD_PILL_CLASS } from '@/lib/card-tokens';

// 칩·좋아요 스타일은 PlanCard와 공유(lib/card-tokens.ts CARD_PILL_CLASS) — 테마 분기·그림자·헤어라인 포함.
// inset 링(테두리 대신)은 auto-width 칩이 real border로 0.5px 커져 플랜파인더 칩과 어긋나는 걸 막는다(레이아웃 영향 0).

export interface StoryCardProps {
  id: string;
  thumbnail: string | null;
  title: string;
  createdAt: Date;
  likeCount: number;
  isLiked?: boolean; // 뷰어가 누른 좋아요면 하트를 빨강으로 (0439, PlanCard와 동일 원리)
  work?: string | null;
  extraWorkCount?: number; // 대표 작품 외 나머지 distinct 작품 수 ("호텔 델루나 +N" 신호, 0437)
  location?: string | null;
  extraLocationCount?: number; // 첫 장소 외 나머지 장소 수 ("외 N곳" 신호, 0439). 작품 +N과 세는 대상 다름.
}

export function StoryCard({ id, thumbnail, title, createdAt, likeCount, isLiked, work, extraWorkCount, location, extraLocationCount }: StoryCardProps) {
  return (
    <Link href={`/story/${id}`} className="group block cursor-pointer">
      <div className="relative aspect-[4/3] rounded-[12px] overflow-hidden bg-surface2">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt=""
            fill
            // 0535: 밴드를 그리드 bp(514/758/1002/1490 — StoryCardList·MyStoryCardGrid 공통)와
            // 1:1 재동기. 구 값은 md/lg/2xl 시절 화석 — 0448(모바일 1열 전환) 후 1열 밴드를
            // 50vw로 절반 해상도 서빙 중이었다. 분기점 = 그리드 bp − 1, 비율은 소폭 상향 여유.
            sizes="(max-width: 513px) 100vw, (max-width: 757px) 50vw, (max-width: 1001px) 34vw, (max-width: 1489px) 25vw, 17vw"
            className="object-cover transition-transform duration-[400ms] group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xs">이미지 없음</div>
        )}
        {/* 상단 바 — 칩(좌)·좋아요(우)를 flex 한 줄로 배치(PlanCard 상단 바와 동일 원리).
            이전엔 둘 다 absolute라 긴 작품명 칩의 max-w가 좋아요 폭을 못 빼 겹쳤다(0447).
            이제 칩은 min-w-0로 줄어들며 잘리고, 좋아요는 ml-auto·shrink-0로 항상 온전히 보인다. */}
        <div className="absolute inset-x-2 top-2 flex items-start gap-2">
          {/* 칩 — 지오메트리(11px·3/9·radius-full)는 PlanCard와 동일, 재질은 불투명 흰+어두운 글씨.
              "호텔 델루나 +2": 이름만 truncate(min-w-0), +N은 shrink-0으로 이름이 잘려도 항상 보임
              (신호 소실 방지). +N은 같은 고정 fg를 opacity로 옅게 — text-muted 같은 토큰은 다크에서
              뒤집혀 흰 배경 위 가독 붕괴하므로 금지(칩 전체가 리터럴 fg를 쓰는 이유와 동일). */}
          {work && (
            <span
              className={`min-w-0 inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] leading-none font-medium ${CARD_PILL_CLASS}`}
            >
              <span className="truncate min-w-0">{work}</span>
              {extraWorkCount ? <span className="shrink-0 ml-1 opacity-55">+{extraWorkCount}</span> : null}
            </span>
          )}
          {/* 좋아요 — 우측(PlanCard와 같은 크기). ml-auto=칩 유무와 무관하게 우측, shrink-0=칩이 길어도 온전. */}
          <span
            className={`ml-auto shrink-0 inline-flex items-center gap-1 rounded-full px-[9px] py-[3px] text-[12.5px] leading-none font-medium ${CARD_PILL_CLASS}`}
          >
            {/* 내가 누른 좋아요만 빨강 채움. 다른 사람 좋아요·미좋아요는 이전 디자인(어두운 하트). */}
            <Heart size={13} className={isLiked ? 'fill-heart-active text-heart-active' : undefined} />
            {likeCount}
          </span>
        </div>
      </div>
      {/* 0436: 제목·날짜·위치 12px(text-xs, §5 하한). 제목은 흰 배경+어두운 글씨라 같은 500이어도
          사진 위 흰 글씨보다 굵게 읽혀 기본 굵기(400)로 낮춰 플랜파인더 제목 체감과 맞춘다. */}
      <h2 className="mt-2 text-xs font-normal text-fg break-keep line-clamp-2 tracking-[-0.02em]">{title}</h2>
      {/* 날짜 · 📍위치 한 줄. 구분자는 PlanCard 메타와 같은 가운뎃점. 긴 지역명은 잘림. */}
      <div className="mt-0.5 flex items-center gap-1.5 text-xs min-w-0">
        <span className="text-muted shrink-0">{formatStoryCardDate(createdAt)}</span>
        {location && (
          <>
            <span className="text-border shrink-0" aria-hidden>·</span>
            <span className="flex items-center gap-0.5 min-w-0 text-fg2">
              <MapPin size={12} className="shrink-0" />
              {/* 이름만 truncate(min-w-0), "외 N곳"은 shrink-0으로 이름이 잘려도 항상 보임(작품 칩 +N과 동일).
                  색은 부모 text-fg2 상속 — 장소명과 같은 톤으로 진하게. */}
              <span className="truncate min-w-0">{location}</span>
              {extraLocationCount ? <span className="shrink-0">외 {extraLocationCount}곳</span> : null}
            </span>
          </>
        )}
      </div>
    </Link>
  );
}
