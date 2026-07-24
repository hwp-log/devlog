// 새 글 본문 양식(서식) 정의 — StoryWriteForm(프리필)·TiptapEditor(placeholder)·FormatMenu(교체) 공유.
// 저장 형식이 HTML 문자열이므로 골격도 HTML로 둔다.
// 양식 배열을 단일 소스로 두고 프리필 HTML·placeholder(도입부/섹션)·교체 삽입을 모두 파생 —
// 제목 문자열이 여러 곳에 흩어져 한쪽만 바뀌면 매칭이 조용히 끊기는 무음 실패를 막기 위함.
// 모든 섹션 heading은 5양식 전체에서 유일해야 한다(survivor 매칭이 heading 텍스트 기준).
// v1.1에서 사용자 저장 양식을 이 배열에 합칠 수 있는 형태로 둔다.
//
// 도입부 placeholder는 두 줄(1행 안내문 + 줄바꿈 + 2행 "예: ...")이라 문자열에 \n을 담는다.
// 섹션 placeholder는 "예: ..." 한 덩어리(안내문 없음).

export const STORY_FORMS = [
  {
    key: 'essay',
    name: '에세이형',
    description: '감상 중심으로, 이야기하듯',
    sections: [
      {
        heading: '여행의 시작',
        prompt:
          '예: 동백꽃 필 무렵을 다시 보고 나서 구룡포라는 이름이 계속 남았다. 다음 주말에 무작정 기차를 탔다.',
      },
      {
        heading: '기억에 남는 순간',
        prompt:
          '예: 그렇게 올라간 언덕에서 바다가 한눈에 들어왔다. 동백과 용식이 앉아 있던 자리는 지금 공원이 되어 있었다.',
      },
      {
        heading: '그곳에서의 생각',
        prompt:
          '예: 내려오는 길에 생각했다. 드라마가 끝나도 그 동네는 계속 살아가고 있구나.',
      },
    ],
  },
  {
    key: 'review',
    name: '정보 리뷰형',
    description: '한 곳을 정보 위주로 꼼꼼하게',
    sections: [
      {
        heading: '다녀온 곳',
        prompt:
          '예: 식객에서 운암정 본채로 나온 서울 삼청각에 다녀왔다. 지금도 한정식을 내는 곳이다.',
      },
      {
        heading: '기본 정보',
        prompt:
          '예: 점심 코스가 5만 원대부터 시작한다. 예약은 미리 하는 편이 확실하고, 주차는 마당에 할 수 있다.',
      },
      {
        heading: '솔직 후기',
        prompt:
          '예: 그 값이 아깝지 않았던 건 음식보다 공간이었다. 창밖으로 산자락이 그대로 들어온다.',
      },
      {
        heading: '팁',
        prompt:
          '예: 창가 자리를 원하면 예약할 때 말해두는 게 좋다. 드라마 장면을 찾아볼 거라면 식사 전후로 마당 둘러볼 시간을 잡아두자.',
      },
    ],
  },
  {
    key: 'course',
    name: '일차별 코스형',
    description: '여러 날 일정을 하루씩',
    sections: [
      {
        heading: '다녀온 코스정보',
        prompt:
          '예: 갯마을 차차차 촬영지를 따라 도는 포항 1박 2일. 청하면을 거점으로 잡고 해안선을 따라 내려갔다.',
      },
      {
        heading: '1일차',
        prompt:
          '예: 청하공진시장에서 시작했다. 공진반점과 보라슈퍼가 나란히 있고, 오윤카페 앞은 사진 찍는 줄이 길었다.',
      },
      {
        heading: '2일차',
        prompt:
          '예: 다음 날은 석병1리 방파제의 빨간 등대부터. 오후에는 월포해수욕장까지 걸었는데 이 구간이 제일 좋았다.',
      },
      {
        heading: '이 코스의 팁',
        prompt:
          '예: 차가 편하다. 다시 짠다면 시장을 오전 일찍 들르고 등대는 해 질 무렵에 두겠다.',
      },
    ],
  },
  {
    key: 'pilgrimage',
    name: '촬영지 순례형',
    description: '그 장면을 찾아간 기록',
    sections: [
      {
        heading: '작품과 장소',
        prompt:
          '예: 수리남에서 전요환의 남미 저택으로 나온 그 건물. 실제로는 서귀포 바닷가의 허니문하우스다.',
      },
      {
        heading: '그 장면, 그 자리',
        prompt:
          '예: 드라마의 그 구도는 정문 담장 앞에서 올려다보면 나온다. 야자수까지 프레임에 넣으면 시그니처 컷 완성.',
      },
      {
        heading: '방문 정보',
        prompt:
          '예: 다만 그 각도를 찍을 수 있는 건 카페 영업 구역까지다. 본관 내부는 출입 제한이고, 사람 없는 컷을 원하면 평일 오전이 한적하다.',
      },
      {
        heading: '같이 갈 만한 곳',
        prompt:
          '예: 여기까지 왔다면 차로 20분 거리 표선 해수욕장도 수리남의 다른 씬 촬영지다. 해질녘에 맞춰 가면 딱 그 장면.',
      },
    ],
  },
  {
    key: 'free',
    name: '자유형',
    description: '서식 없이 자유롭게 — 빈 소제목은 정리돼요',
    sections: [],
  },
] as const;

// 섹션 1개 → HTML(제목 + 빈 문단). 프리필·양식 교체 삽입이 공유하는 단일 규칙.
function sectionToHtml(heading: string): string {
  return `<h2>${heading}</h2><p></p>`;
}

function formByKey(key: string): (typeof STORY_FORMS)[number] {
  const form = STORY_FORMS.find((f) => f.key === key);
  if (!form) throw new Error(`unknown form key: ${key}`);
  return form;
}

// 양식 골격 HTML((H2 + 빈 문단) × N). 도입부는 이제 첫 섹션(heading)이라 별도 빈 문단 없음.
export function formSkeletonHtml(sections: readonly { heading: string }[]): string {
  return sections.map((s) => sectionToHtml(s.heading)).join('');
}

// 프리필(0334) = 촬영지 순례형(④)에서 파생 — 골격 정의가 두 곳에 생기지 않게.
export const STORY_TEMPLATE_HTML = formSkeletonHtml(formByKey('pilgrimage').sections);

// placeholder 섹션 매핑 대상 = 전 양식 섹션 합집합(heading 중복 제거, 첫 등장 prompt 우선).
export const STORY_ALL_SECTIONS: { heading: string; prompt: string }[] = (() => {
  const seen = new Map<string, string>();
  for (const form of STORY_FORMS) {
    for (const s of form.sections) {
      if (!seen.has(s.heading)) seen.set(s.heading, s.prompt);
    }
  }
  return [...seen].map(([heading, prompt]) => ({ heading, prompt }));
})();

// 양식 교체 판정: 이미 본문에 살아남은(내용 있는) 섹션과 heading이 겹치는 것은 빼고
// 삽입할 섹션만 남긴다. 표시(각주)와 실제 삽입이 이 함수를 공유해 어긋나지 않게 한다.
// heading 텍스트 기준 — 사용자가 제목을 바꿨으면 다른 섹션으로 보고 삽입한다.
export function sectionsToInsert(
  formSections: readonly { heading: string; prompt: string }[],
  survivingHeadings: ReadonlySet<string>,
): { heading: string; prompt: string }[] {
  return formSections.filter((s) => !survivingHeadings.has(s.heading));
}
