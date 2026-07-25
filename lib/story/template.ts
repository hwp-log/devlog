// 새 글 본문 양식(서식) 5종 정의 — StoryWriteForm(프리필)·FormatMenu(교체)·StoryPlaceholder(과도기) 공유.
// 저장 형식이 HTML 문자열이므로 골격도 HTML로 둔다.
// 0355: placeholder 방식 폐기 — 예시가 실제 텍스트로 본문에 통째로 들어간다(브런치 방식).
// 정본: docs/design/mockups/dotrip-양식-프리필-최종본.html — 문구는 시안 그대로, 임의 다듬기 금지.
// 양식 배열을 단일 소스로 두고 프리필 HTML·교체 삽입·예시 원문 서명·placeholder 매핑을 모두 파생 —
// 같은 사실이 두 곳에 정의되면 한쪽만 바뀌어 매칭이 조용히 끊기는 무음 실패를 막기 위함.
// 모든 섹션 heading은 5양식 전체에서 유일해야 한다(survivor 매칭·예시 서명이 heading 텍스트 기준).
// 장소명(서귀포 허니문하우스 류)은 일반 텍스트 — 장소 칩은 향후 스팟 링크 기능과 함께 도입(사용자 확정).
// v1.1에서 사용자 저장 양식을 이 배열에 합칠 수 있는 형태로 둔다.
//
// 구조(4양식 공통 골격): 도입 섹션(H2 + 인용으로 감싼 첫 문단) → 본문 섹션들 → tailHtml.
// tailHtml = hr + 💡팁 + ❓FAQ 콜아웃 묶음. heading 구간 규칙상 "마지막 섹션 구간"에 속한다 —
// 삽입(resolveFormatInsertion)과 판정(PRISTINE_TEXT_BY_HEADING)이 이 전제를 공유한다.
// 콜아웃 HTML은 0352 저장 규약(div[data-callout] > p+, 첫 p=제목, FAQ 2번째 p=질문) 준수.
// 이모지는 데이터에 없음(CSS ::before 파생) — 제목·본문 텍스트에 이모지 금지.

export const STORY_FORMS = [
  {
    key: 'essay',
    name: '에세이형',
    description: '감상 중심으로, 이야기하듯',
    sections: [
      {
        heading: '여행의 시작',
        bodyHtml:
          '<blockquote><p>동백꽃 필 무렵을 다시 보고 나서 구룡포라는 이름이 계속 남았다. 다음 주말에 무작정 기차를 탔다.</p></blockquote>',
      },
      {
        heading: '기억에 남는 순간',
        bodyHtml:
          '<p>그렇게 올라간 언덕에서 바다가 한눈에 들어왔다. 동백과 용식이 앉아 있던 자리는 지금 공원이 되어 있었다.</p><blockquote><p>“드라마가 끝나도 그 동네는 계속 살아있구나”</p></blockquote>',
      },
      {
        heading: '그곳에서의 생각',
        bodyHtml:
          '<p>내려오는 길에 생각했다. 화면으로 백 번 본 곳도 직접 서 보면 전혀 다른 장소가 된다고.</p>',
      },
    ],
    tailHtml:
      '<hr><div data-callout="tip"><p>가는 길</p><p>구룡포항 뒤편에서 언덕까지 걸어서 5분. 계단이 가파르니 편한 신발로.</p></div><div data-callout="faq"><p>자주 묻는 질문</p><p>겨울에 가도 괜찮나요?</p><p>바람이 세지만 사람이 적어 오히려 조용합니다.</p></div>',
  },
  {
    key: 'review',
    name: '정보 리뷰형',
    description: '한 곳을 정보 위주로 꼼꼼하게',
    sections: [
      {
        heading: '다녀온 곳',
        bodyHtml:
          '<blockquote><p>식객에서 운암정 본채로 나온 서울 삼청각에 다녀왔다.</p></blockquote>',
      },
      {
        heading: '기본 정보',
        bodyHtml:
          '<ul><li><p><strong>가격</strong> — 점심 코스 5만 원대부터</p></li><li><p><strong>예약</strong> — 미리 하는 편이 확실</p></li><li><p><strong>주차</strong> — 마당에 가능</p></li></ul>',
      },
      {
        heading: '솔직 후기',
        bodyHtml:
          '<p>그 값이 아깝지 않았던 건 음식보다 공간이었다. 창밖으로 산자락이 그대로 들어온다.</p>',
      },
    ],
    tailHtml:
      '<hr><div data-callout="tip"><p>가기 전에</p><p>창가 자리를 원하면 예약할 때 말해두는 게 좋다.</p></div><div data-callout="faq"><p>자주 묻는 질문</p><p>예약 없이 가도 되나요?</p><p>주말은 자리가 없을 수 있어요. 평일 점심은 당일도 가능한 편입니다.</p></div>',
  },
  {
    key: 'course',
    name: '일차별 코스형',
    description: '여러 날 일정을 하루씩',
    sections: [
      {
        heading: '다녀온 코스정보',
        bodyHtml:
          '<blockquote><p>갯마을 차차차 촬영지를 따라 도는 포항 1박 2일. 청하면을 거점으로 잡았다.</p></blockquote>',
      },
      {
        heading: '1일차',
        bodyHtml:
          '<ul><li><p><strong>청하공진시장</strong> — 공진반점·보라슈퍼가 나란히</p></li><li><p><strong>오윤카페 앞</strong> — 사진 찍는 줄이 길다</p></li></ul>',
      },
      {
        heading: '2일차',
        bodyHtml:
          '<ul><li><p><strong>석병1리 방파제</strong> — 빨간 등대</p></li><li><p><strong>월포해수욕장</strong> — 이 구간이 제일 좋았다</p></li></ul>',
      },
    ],
    tailHtml:
      '<hr><div data-callout="tip"><p>이 코스의 팁</p><p>차가 편하다. 시장을 오전 일찍 들르고 등대는 해 질 무렵에 두면 좋다.</p></div><div data-callout="faq"><p>자주 묻는 질문</p><p>대중교통으로도 갈 수 있나요?</p><p>버스가 드물어 차를 권합니다. 포항 시내에서 청하면까지 40분쯤 걸려요.</p></div>',
  },
  {
    key: 'pilgrimage',
    name: '촬영지 순례형',
    description: '그 장면을 찾아간 기록',
    sections: [
      {
        heading: '작품과 장소',
        bodyHtml:
          '<blockquote><p>수리남에서 전요환의 남미 저택으로 나온 그 건물, 실제로는 서귀포 허니문하우스다.</p></blockquote>',
      },
      {
        heading: '그 장면, 그 자리',
        bodyHtml:
          '<ul><li><p><strong>정문 담장</strong> — 시그니처 로우앵글 컷</p></li><li><p><strong>야자수 라인</strong> — 프레임 좌측을 채우는 열대감</p></li></ul><blockquote><p>“해질녘에 맞춰 가면, 딱 그 장면”</p></blockquote>',
      },
      {
        heading: '방문 정보',
        bodyHtml:
          '<p>사진을 찍을 수 있는 건 카페 영업 구역까지다. 본관 내부는 출입 제한이다.</p>',
      },
    ],
    tailHtml:
      '<hr><div data-callout="tip"><p>촬영 꿀팁</p><p>정문 담장 앞에서 살짝 올려다보는 로우앵글이 그 장면과 가장 비슷하다.</p></div><div data-callout="faq"><p>자주 묻는 질문</p><p>입장료가 있나요?</p><p>카페 이용 시 별도 입장료는 없어요.</p></div>',
  },
  {
    key: 'free',
    name: '자유형',
    description: '서식 없이 자유롭게 — 빈 소제목은 정리돼요',
    sections: [],
    tailHtml: '',
  },
] as const;

// 섹션 1개 → 삽입 HTML(제목 + 예시 본문). 프리필·양식 교체 삽입이 공유하는 단일 규칙.
function sectionToHtml(s: { heading: string; bodyHtml: string }): string {
  return `<h2>${s.heading}</h2>${s.bodyHtml}`;
}

function formByKey(key: string): (typeof STORY_FORMS)[number] {
  const form = STORY_FORMS.find((f) => f.key === key);
  if (!form) throw new Error(`unknown form key: ${key}`);
  return form;
}

// 태그를 공백으로 치환해 텍스트만 추출 — 상수는 이 파일이 통제(엔티티·꺾쇠 텍스트 없음 전제)라
// 정규식으로 충분. ProseMirror doc.textContent와 "공백 제거 후" 일치하도록 설계됐다.
function htmlToText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// 예시 원문 판정용 정규화 — 모든 공백(스페이스·개행·탭·NBSP) 제거 후 완전 일치로 비교한다.
// 공백·서식(태그·마크)만 다른 편집은 사용자 산문이 없으므로 예시로 취급하고,
// 글자 하나라도 다르면 사용자 내용으로 본다. HTML 문자열 비교를 피하는 이유:
// Tiptap 직렬화 편차(li>p 래핑 등)가 예시를 사용자 내용으로 오판해 중복 누적을 재발시킨다.
export function normalizePristineText(text: string): string {
  return text.replace(/\s+/g, '');
}

// 양식 교체·프리필의 삽입 HTML 해석 — 삽입 HTML은 이 함수 하나로만 만든다
// (FormatMenu의 전체 교체·부분 삽입 두 경로와 STORY_TEMPLATE_HTML이 공용).
// 표시(각주)와 삽입은 같은 classifyDocSections 결과(survivingHeadings)를 공유해 어긋나지 않는다.
// 살아남는 섹션과 heading이 겹치면 제외 — 사용자가 제목을 바꿨으면 다른 섹션으로 보고 삽입한다.
// tailHtml은 마지막 섹션 구간 소속이라 "마지막 섹션이 삽입될 때만" 함께 넣는다
// (마지막 섹션이 살아남았으면 옛 콜아웃이 그 구간에 남아 있어, 또 넣으면 팁·FAQ가 중복된다).
// tail 뒤 빈 문단 1개: isolating 콜아웃이 문서 끝이면 이어쓰기 커서 자리가 없어서(사용자 확정).
export function resolveFormatInsertion(
  form: { sections: readonly { heading: string; bodyHtml: string }[]; tailHtml: string },
  survivingHeadings: ReadonlySet<string>,
): string {
  const toInsert = form.sections.filter((s) => !survivingHeadings.has(s.heading));
  const last = form.sections[form.sections.length - 1];
  const withTail = last !== undefined && toInsert.includes(last);
  return toInsert.map(sectionToHtml).join('') + (withTail ? `${form.tailHtml}<p></p>` : '');
}

// 프리필 = 촬영지 순례형(④)에서 파생 — 골격 정의가 두 곳에 생기지 않게.
// 분기(initialData?.content ?? STORY_TEMPLATE_HTML)는 StoryWriteForm 유지.
export const STORY_TEMPLATE_HTML = resolveFormatInsertion(formByKey('pilgrimage'), new Set());

// heading → 예시 본문 정규화 서명(전 양식 합집합 — heading 유일성 전제).
// 마지막 섹션 서명엔 tailHtml 텍스트 포함(콜아웃이 그 구간에 속하므로 구간 텍스트와 대응).
// 소비처: empty-sections-doc.ts 교체 판정 — "예시 원문 그대로인 구간 = 빈 것"의 비교 기준.
export const PRISTINE_TEXT_BY_HEADING: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const form of STORY_FORMS) {
    form.sections.forEach((s, i) => {
      const tail = i === form.sections.length - 1 ? form.tailHtml : '';
      m.set(s.heading, normalizePristineText(htmlToText(s.bodyHtml + tail)));
    });
  }
  return m;
})();

// placeholder 섹션 매핑(StoryPlaceholder 소비) — 과도기: 프리필이 실제 텍스트가 되어 새 글에는
// 안 뜨고, 사용자가 섹션 본문을 비웠을 때만 예시 텍스트가 회색으로 남는다.
// StoryPlaceholder 제거(다음 커밋)와 함께 삭제 예정. prompt는 bodyHtml에서 파생(별도 정의 금지).
export const STORY_ALL_SECTIONS: { heading: string; prompt: string }[] = (() => {
  const seen = new Map<string, string>();
  for (const form of STORY_FORMS) {
    for (const s of form.sections) {
      if (!seen.has(s.heading)) seen.set(s.heading, htmlToText(s.bodyHtml));
    }
  }
  return [...seen].map(([heading, prompt]) => ({ heading, prompt }));
})();
