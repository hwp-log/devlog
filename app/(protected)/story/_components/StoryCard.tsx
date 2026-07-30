import Link from 'next/link';
import Image from 'next/image';
import { Heart, MapPin } from 'lucide-react';
import { formatStoryCardDate } from '@/lib/format-date';

// 칩·좋아요 재질 — 거의 불투명한 흰색 배경 + 어두운 글씨(블러 없음).
// 1.0은 사진을 완전히 막아 오려 붙인 듯 딱딱하고, 0.72는 뒤가 너무 통과해 밝은 사진에서 대비가 무너진다.
// 0.92는 사진이 거의 안 통과할 정도만 열어 재질감을 주면서 어떤 밝기에서도 어두운 글씨 대비를 유지한다.
// PlanCard(스크림 위 반투명 검정)와 의도적으로 다름 — 스토리 썸네일엔 스크림이 없다.
const STORY_PILL_BG = 'rgba(255,255,255,0.92)';
// text-fg 토큰은 다크에서 밝게 뒤집혀 흰 배경 위 가독이 붕괴 → 라이트 fg(theme.ts #191a1c) 리터럴로 고정.
const STORY_PILL_FG = '#191a1c';
// 그림자로 칩을 사진 위에 띄우고(0 1px 3px), 하단 inset 링으로 밝은 사진에서 윤곽을 잡는다(0436의 shadow-sm 역할).
// 테두리를 real `border`로 주면 intrinsic-width 칩은 box-sizing:border-box여도 외곽이 0.5px씩 커져
// 플랜파인더 칩과 크기가 어긋난다(auto width엔 border-box가 흡수 못 함) → inset box-shadow 링으로 레이아웃 영향 0.
const STORY_PILL_SHADOW = '0 1px 3px rgba(0,0,0,0.12), inset 0 0 0 0.5px rgba(0,0,0,0.08)';

export interface StoryCardProps {
  id: string;
  thumbnail: string | null;
  title: string;
  createdAt: Date;
  likeCount: number;
  work?: string | null;
  extraWorkCount?: number; // 대표 작품 외 나머지 distinct 작품 수 ("호텔 델루나 +N" 신호, 0437)
  location?: string | null;
}

export function StoryCard({ id, thumbnail, title, createdAt, likeCount, work, extraWorkCount, location }: StoryCardProps) {
  return (
    <Link href={`/story/${id}`} className="group block cursor-pointer">
      <div className="relative aspect-[4/3] rounded-[12px] overflow-hidden bg-surface2">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt=""
            fill
            sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, (max-width: 1535px) 20vw, 17vw"
            className="object-cover transition-transform duration-[400ms] group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xs">이미지 없음</div>
        )}
        {/* 칩 — 지오메트리(11px·3/9·radius-full)는 PlanCard와 동일, 재질은 불투명 흰+어두운 글씨.
            "호텔 델루나 +2": 이름만 truncate(min-w-0), +N은 shrink-0으로 이름이 잘려도 항상 보임
            (신호 소실 방지). +N은 같은 고정 fg를 opacity로 옅게 — text-muted 같은 토큰은 다크에서
            뒤집혀 흰 배경 위 가독 붕괴하므로 금지(칩 전체가 리터럴 fg를 쓰는 이유와 동일). */}
        {work && (
          <span
            className="absolute top-2 left-2 max-w-[calc(100%-1rem)] inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] leading-none font-medium"
            style={{ backgroundColor: STORY_PILL_BG, color: STORY_PILL_FG, boxShadow: STORY_PILL_SHADOW }}
          >
            <span className="truncate min-w-0">{work}</span>
            {extraWorkCount ? <span className="shrink-0 ml-1 opacity-55">+{extraWorkCount}</span> : null}
          </span>
        )}
        {/* 좋아요 — 상단 우측(PlanCard와 같은 크기). 칩과 동일 불투명 흰 배경. 0도 그대로 표시. */}
        <span
          className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-[9px] py-[3px] text-[12.5px] leading-none font-medium"
          style={{ backgroundColor: STORY_PILL_BG, color: STORY_PILL_FG, boxShadow: STORY_PILL_SHADOW }}
        >
          <Heart size={13} />
          {likeCount}
        </span>
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
              <span className="truncate">{location}</span>
            </span>
          </>
        )}
      </div>
    </Link>
  );
}
