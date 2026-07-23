// 데이터 출처 표기 단일 소스 — 공통 푸터(footer)·SpotFinder 상세뷰(compact)가 공유.
// 공공누리 유형 표기 없음 — 문화정보원 데이터셋(15111405)은 이용허락범위 제한 없음이라 유형 표기 대상 아님.

export const ATTRIBUTION = {
  kcisa: {
    name: '한국문화정보원',
    dataset: '미디어콘텐츠 영상 촬영지 데이터',
    url: 'https://www.data.go.kr/data/15111405/fileData.do',
  },
  kto: {
    name: '한국관광공사',
    api: 'TourAPI',
    url: 'https://api.visitkorea.or.kr/',
  },
} as const;

// 12px 회색 본문에서 링크 식별용 밑줄 — 색은 주변 톤(text-muted) 상속 유지
const LINK_CLS = 'underline underline-offset-2 hover:text-fg2';

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLS}>
      {children}
    </a>
  );
}

export function DataAttribution({ variant }: { variant: 'footer' | 'compact' }) {
  const { kcisa, kto } = ATTRIBUTION;

  if (variant === 'compact') {
    return (
      <span className="text-xs text-muted">
        출처: <SourceLink href={kcisa.url}>{kcisa.name}</SourceLink>
        {/* 구분점 좌우 여백 = 인접 터치 타겟 간 8px 이상 확보 (CLAUDE.md §5) */}
        <span className="mx-1">·</span>
        <SourceLink href={kto.url}>{kto.name}</SourceLink>
      </span>
    );
  }

  // 두 문장 = 각자 블록(<p>) — 문장 중간 줄바꿈과 구분. 간격은 leading-relaxed만(문단 마진 없음 = 한 덩어리)
  return (
    <div className="max-w-md text-xs text-muted leading-relaxed break-keep">
      <p>
        촬영지 정보는 <SourceLink href={kcisa.url}>{kcisa.name}</SourceLink> 「{kcisa.dataset}」를
        이용했습니다.
      </p>
      <p>
        일부 사진은{' '}
        <SourceLink href={kto.url}>
          {kto.name} {kto.api}
        </SourceLink>
        를 이용했습니다.
      </p>
    </div>
  );
}
