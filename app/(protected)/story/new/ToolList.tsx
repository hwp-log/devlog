'use client';
import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from 'react';
import type { ChainedCommands, Editor, Range } from '@tiptap/core';
import {
  Bold, Italic, Heading2, Heading3, AArrowDown, Strikethrough, Code,
  Link as LinkIcon, List, Quote, Lightbulb, MessageCircleQuestion, TriangleAlert,
  Image as ImageIcon, LayoutTemplate, X, Check,
  type LucideIcon,
} from 'lucide-react';

// 공용 도구 목록(0468) — 텍스트 선택(BubbleMenu 내용)·슬래시·툴바 ⋯ 스왑 세 진입점이
// 이 한 벌(항목 15종 + ToolList)을 쓴다. 0464에서 미뤘던 셸·행 클래스 공용 추출의 이행 —
// SlashMenu·BubbleMore·ToolbarMore의 문자열 복제 3벌을 여기로 단일화.
// 진입점별 항목 분리 없음 — 상황에 안 맞는 항목은 can 판정이 회색으로 걸러준다(사용자 확정).
// auto-focus 전무(0467 원칙: 포커스를 안 뺏어야 iOS 선택 표시가 산다) — 키보드 순회는
// 슬래시 Suggestion 경유 onKeyDown 핸들로만 제공.

// can 판정 단일 소스 — TiptapEditor useEditorState selector(리렌더 트리거)와
// 슬래시 items()(호출 시점 실시간)가 같은 함수를 쓴다. 값 정의가 두 곳으로 갈리면
// "selector는 회색인데 목록은 활성" 어긋남이 생기므로 반드시 여기 한 곳만 수정.
export function computeCanMap(e: Editor) {
  return {
    canBold: e.can().toggleBold(),
    canItalic: e.can().toggleItalic(),
    canStrike: e.can().toggleStrike(),
    canCode: e.can().toggleCode(),
    // 작게×제목은 PM 무차단인 우리 문제(13px 고정이 제목을 이김, 0465) — 여기서 금지 확정.
    // globals.css의 제목 안 [data-size] 가드와 짝
    canSize: e.can().toggleSmall() && !e.isActive('heading'),
    canLink: e.can().setMark('link'), // setLink는 href 검증이 겹쳐 setMark로 canSetMark만 판단
    canHeading2: e.can().toggleHeading({ level: 2 }),
    canHeading3: e.can().toggleHeading({ level: 3 }),
    canBulletList: e.can().toggleBulletList(),
    canBlockquote: e.can().toggleBlockquote(),
    canCallout: e.can().insertCallout('tip'), // 콜아웃 안 재삽입 금지(Callout.ts 명시 false) — kind 무관
  };
}
export type CanMap = ReturnType<typeof computeCanMap>;

// 활성(적용 중) 판정 단일 소스(0469) — can 맵과 같은 이유로 여기 한 곳만 수정.
// TiptapEditor useEditorState selector(리렌더 트리거)와 슬래시 items()(호출 시점 실시간)가
// 같은 함수를 써야 "툴바 버튼은 활성인데 목록 행은 무표시" 어긋남이 없다
export function computeActiveMap(e: Editor) {
  return {
    bold: e.isActive('bold'),
    italic: e.isActive('italic'),
    heading2: e.isActive('heading', { level: 2 }),
    heading3: e.isActive('heading', { level: 3 }),
    bulletList: e.isActive('bulletList'),
    blockquote: e.isActive('blockquote'),
    calloutTip: e.isActive('callout', { kind: 'tip' }),
    calloutFaq: e.isActive('callout', { kind: 'faq' }),
    calloutWarn: e.isActive('callout', { kind: 'warn' }),
    strike: e.isActive('strike'),
    code: e.isActive('code'),
    size: e.isActive('size'),
    link: e.isActive('link'),
  };
}
export type ActiveMap = ReturnType<typeof computeActiveMap>;

// 링크 URL prompt — 툴바 버튼·목록 항목 공용(중복 금지 규칙 승계, 구 TiptapEditor.handleLink)
export function promptLink(editor: Editor) {
  const url = window.prompt('URL을 입력하세요:');
  if (url === null) return;
  if (url === '') {
    editor.chain().focus().unsetLink().run();
    return;
  }
  editor.chain().focus().setLink({ href: url }).run();
}

export type ToolItem = {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: string[]; // 슬래시 검색용 — label 포함 매칭과 병행
  disabled: boolean;
  // 적용 중(0469) — undefined = 토글이 아닌 항목(이미지·서식), 체크·menuitemcheckbox 미대상
  active?: boolean;
  // range는 슬래시 전용 — 있으면 deleteRange를 같은 체인에 선행(단일 트랜잭션, undo 1회)
  run: (editor: Editor, range?: Range) => void;
};

// 체인 계열 항목 공통 실행기 — 슬래시 range 삭제를 같은 트랜잭션으로 묶는다
function chainRun(fn: (c: ChainedCommands) => ChainedCommands) {
  return (editor: Editor, range?: Range) => {
    let c = editor.chain().focus();
    if (range) c = c.deleteRange(range);
    fn(c).run();
  };
}

// 비체인 항목(링크 prompt·이미지 픽커·서식 뷰) — range 삭제만 선행하고 핸들러 호출
function actionRun(action: (editor: Editor) => void) {
  return (editor: Editor, range?: Range) => {
    if (range) editor.chain().focus().deleteRange(range).run();
    action(editor);
  };
}

// 항목 15종(서식은 onFormat 제공 시에만 — 아래 주석) — 순서는 자주 쓰는 순(사용자 지정):
// 첫 줄(모바일 1행 노출)에 굵게·기울임·제목이 오게.
// 라벨·설명·아이콘은 기존 툴바·슬래시 어휘 재사용, keywords는 마크 6종에 신규 부여
// onFormat 선택적(0471) — 서식은 글 시작 1회성이라 선택·슬래시 맥락에서 제외.
// "항상 포함 후 호출처가 필터" 대신 핸들러를 제공한 호출처(툴바 ⋯ 스왑뿐)에만 항목이
// 생기게 해, 핸들러 없는 항목이 목록에 뜨는 부정합을 타입 차원에서 봉쇄
export function buildToolItems(
  state: CanMap & ActiveMap,
  { onImagePick, onFormat }: { onImagePick: () => void; onFormat?: () => void },
): ToolItem[] {
  return [
    { key: 'bold', label: '굵게', description: '진하게 강조', icon: Bold, keywords: ['굵게', 'bold'], disabled: !state.canBold, active: state.bold, run: chainRun((c) => c.toggleBold()) },
    { key: 'italic', label: '기울임', description: '기울여 강조', icon: Italic, keywords: ['기울임', 'italic'], disabled: !state.canItalic, active: state.italic, run: chainRun((c) => c.toggleItalic()) },
    { key: 'heading2', label: '제목', description: '섹션 제목(H2)', icon: Heading2, keywords: ['제목', 'h2', 'heading', 'title'], disabled: !state.canHeading2, active: state.heading2, run: chainRun((c) => c.toggleHeading({ level: 2 })) },
    { key: 'heading3', label: '소제목', description: '소제목(H3)', icon: Heading3, keywords: ['소제목', 'h3'], disabled: !state.canHeading3, active: state.heading3, run: chainRun((c) => c.toggleHeading({ level: 3 })) },
    { key: 'size', label: '작게', description: '선택한 글자를 작게', icon: AArrowDown, keywords: ['작게', 'small'], disabled: !state.canSize, active: state.size, run: chainRun((c) => c.toggleSmall()) },
    { key: 'strike', label: '취소선', description: '가운데 줄 긋기', icon: Strikethrough, keywords: ['취소선', 'strike'], disabled: !state.canStrike, active: state.strike, run: chainRun((c) => c.toggleStrike()) },
    { key: 'code', label: '인라인 코드', description: '코드 서식', icon: Code, keywords: ['코드', 'code', '인라인'], disabled: !state.canCode, active: state.code, run: chainRun((c) => c.toggleCode()) },
    { key: 'link', label: '링크', description: 'URL 연결', icon: LinkIcon, keywords: ['링크', 'link', 'url'], disabled: !state.canLink, active: state.link, run: actionRun(promptLink) },
    { key: 'bulletList', label: '목록', description: '글머리 기호·번호', icon: List, keywords: ['목록', 'list', '불릿', 'bullet'], disabled: !state.canBulletList, active: state.bulletList, run: chainRun((c) => c.toggleBulletList()) },
    { key: 'blockquote', label: '인용', description: '왼쪽 선 강조', icon: Quote, keywords: ['인용', 'quote', 'blockquote'], disabled: !state.canBlockquote, active: state.blockquote, run: chainRun((c) => c.toggleBlockquote()) },
    { key: 'calloutTip', label: '팁 콜아웃', description: '핵심 팁 강조 상자', icon: Lightbulb, keywords: ['팁', 'tip', 'callout', '콜아웃'], disabled: !state.canCallout, active: state.calloutTip, run: chainRun((c) => c.insertCallout('tip')) },
    { key: 'calloutFaq', label: 'FAQ 콜아웃', description: '질문·답변 상자', icon: MessageCircleQuestion, keywords: ['faq', '질문', '문답', 'callout', '콜아웃'], disabled: !state.canCallout, active: state.calloutFaq, run: chainRun((c) => c.insertCallout('faq')) },
    { key: 'calloutWarn', label: '주의 콜아웃', description: '주의사항 강조 상자', icon: TriangleAlert, keywords: ['주의', 'warn', 'warning', 'caution', 'callout', '콜아웃'], disabled: !state.canCallout, active: state.calloutWarn, run: chainRun((c) => c.insertCallout('warn')) },
    { key: 'image', label: '이미지', description: '사진 업로드', icon: ImageIcon, keywords: ['이미지', 'image', '사진', 'photo'], disabled: false, run: actionRun(() => onImagePick()) },
    ...(onFormat
      ? [{ key: 'format', label: '서식', description: '본문 양식 바꾸기', icon: LayoutTemplate, keywords: ['서식', '양식', 'template', 'format'], disabled: false, run: actionRun(() => onFormat()) } satisfies ToolItem]
      : []),
  ];
}

// 플로팅 소비자(선택 목록·슬래시) 공용 셸 — 구 SlashMenu 셸과 동일 어휘.
// 툴바 스왑은 셸 없이 전폭 in-flow라 미사용
export const TOOL_SHELL =
  'w-[250px] rounded-[12px] border border-border bg-card shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)]';

export interface ToolListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface ToolListProps {
  items: ToolItem[];
  command: (item: ToolItem) => void; // 실행은 소비자 몫(슬래시=Suggestion command, 그 외=run 직접)
  onClose: () => void; // ✕ — 선택 목록=hide meta, 슬래시=destroy, 툴바=버튼 뷰 복귀
}

export const ToolList = forwardRef<ToolListHandle, ToolListProps>(function ToolList(
  { items, command, onClose },
  ref,
) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 필터로 items가 줄어든 뒤의 스테일 인덱스는 렌더 파생으로 보정(effect setState 금지 — lint).
  // 비활성 행은 선택 대상 제외(0465 상태 축: 선택=배경 채움/비활성=콘텐츠 강등·배경 금지)
  const firstEnabled = Math.max(0, items.findIndex((it) => !it.disabled));
  const clamped = items.length ? Math.min(selectedIndex, items.length - 1) : 0;
  const effectiveIndex = items[clamped] && !items[clamped].disabled ? clamped : firstEnabled;

  // 키보드 이동 시 선택 항목 가시화 — nearest = 보이면 no-op(구 SlashMenu 그대로)
  useEffect(() => {
    itemRefs.current[effectiveIndex]?.scrollIntoView({ block: 'nearest' });
  }, [effectiveIndex]);

  useImperativeHandle(
    ref,
    () => {
      // 화살표 이동 — 비활성 스킵(전부 비활성이면 제자리). 구 BubbleMore step 이식.
      // 팩토리 안 선언 = deps에 함수 항목 불요(items 파생)
      function step(from: number, dir: 1 | -1) {
        const count = items.length;
        let n = from;
        for (let k = 0; k < count; k++) {
          n = (n + dir + count) % count;
          if (!items[n].disabled) return n;
        }
        return from;
      }
      return {
        // 슬래시 Suggestion 전용 경로 — 다른 진입점은 포커스를 안 가져 키 이벤트가 오지 않는다
        onKeyDown(event) {
          if (items.length === 0) return false;
          if (event.key === 'ArrowDown') {
            setSelectedIndex(step(effectiveIndex, 1));
            return true;
          }
          if (event.key === 'ArrowUp') {
            setSelectedIndex(step(effectiveIndex, -1));
            return true;
          }
          if (event.key === 'Enter') {
            const item = items[effectiveIndex];
            if (!item || item.disabled) return true; // 전부 비활성 — 삼킴(에디터 개행 방지)
            command(item);
            return true;
          }
          return false;
        },
      };
    },
    [items, effectiveIndex, command],
  );

  return (
    // 높이 규격(사용자 확정): 스크롤 영역 모바일 70px(1행+다음 행 걸침 = 스크롤 어포던스),
    // 데스크톱 156px(3행). --tool-avail은 슬래시 size()가 주입하는 화면 가용 높이(탭바 회피
    // 0398 승계) — min()으로 둘 중 작은 쪽. 다른 진입점은 미주입 → 폴백 9999.
    // 0472: max-height→height 고정 — 슬래시 필터로 항목이 줄어도 박스가 안 흔들린다
    // (남는 공간은 공백). ⋯ 스왑은 항상 15항목이 70px를 초과해 계산 결과 동일(131px 무변)
    <div className="[--tool-max:70px] sm:[--tool-max:156px]">
      {/* 헤더 — 좌 스크롤 안내 문구, 우 ✕(모바일 44px 터치 타겟 §5). h-11=44px가 모바일
          툴바 스왑 131px(패딩16+헤더44+구분선1+스크롤70)의 구성 요소 — 한쪽만 바꾸면 어긋남 */}
      <div className="flex h-11 sm:h-9 items-center justify-between pl-[9px]">
        <span className="text-[10px] tracking-[0.08em] text-muted">스크롤 - 여러기능 살피기</span>
        <button
          type="button"
          aria-label="닫기"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:px-2 sm:py-1 rounded text-fg2 hover:bg-popover transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <div aria-hidden className="border-b border-border" />
      <div
        role="menu"
        aria-label="도구 목록"
        className="overflow-y-auto overscroll-none px-1.5 py-1.5"
        style={{ height: 'min(var(--tool-max), var(--tool-avail, 9999px))' }}
      >
        {items.length === 0 ? (
          <div className="px-[9px] py-2 text-sm text-muted">결과 없음</div>
        ) : (
          items.map((item, i) => (
            <button
              key={item.key}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              // 토글 항목만 checkbox 롤 + checked(WAI-ARIA 메뉴 패턴 — 한 menu 안 혼용 허용).
              // 이미지·서식(active undefined)은 menuitem 유지
              role={item.active !== undefined ? 'menuitemcheckbox' : 'menuitem'}
              aria-checked={item.active}
              aria-disabled={item.disabled || undefined}
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault(); // 에디터 포커스·선택 유지 — 실행은 chain().focus() 재적용
                if (!item.disabled) command(item);
              }}
              onMouseEnter={() => {
                if (!item.disabled) setSelectedIndex(i); // 비활성 행은 하이라이트 제외(0465·터치 고착 방지)
              }}
              // hover 클래스 없음 — onMouseEnter가 selectedIndex를 옮겨 hover=선택=surface2 단일 상태 언어.
              // 활성(적용 중)은 우측 체크마크(0469, 0468의 미표시 확정을 실기기 검수로 번복) —
              // Apple HIG 메뉴 상태·Notion turn-into의 표준 신호. 배경 축(선택/hover)·콘텐츠 강등
              // 축(비활성)과 독립인 세 번째 축(글리프)이라 세 상태가 공존해도 안 겹친다
              className={`flex w-full items-center gap-2.5 rounded-lg px-[9px] py-2 text-left transition-colors ${
                i === effectiveIndex && !item.disabled ? 'bg-surface2' : ''
              } ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border-[0.5px] border-border bg-surface2 text-muted">
                <item.icon size={16} />
              </span>
              <span className="flex flex-col">
                <span className={`text-[13px] font-medium ${item.disabled ? 'text-muted' : 'text-fg'}`}>{item.label}</span>
                <span className="mt-px text-xs text-muted">{item.description}</span>
              </span>
              {item.active && <Check size={16} className="ml-auto shrink-0 text-fg" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
});
