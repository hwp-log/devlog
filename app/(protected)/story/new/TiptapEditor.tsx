'use client';
import { useMemo, useRef, useState } from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
// tiptap 확장 Link·Image와 이름 충돌 — 별칭 필수
import {
  Image as ImageIcon, Link as LinkIcon, List, Quote,
  Lightbulb, MessageCircleQuestion, TriangleAlert,
  Strikethrough, Code, AArrowDown, Ellipsis, ArrowLeft, LayoutTemplate,
} from 'lucide-react';
import { uploadStoryImage } from '@/lib/supabase/storage';
import { Callout } from './Callout';
import { SizeMark } from './SizeMark';
import { createSlashCommand } from './SlashCommand';
import { FormatMenu, FormatMenuContent } from './FormatMenu';
import { ToolList, buildToolItems, computeActiveMap, computeCanMap, promptLink, TOOL_SHELL } from './ToolList';

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  userId: string;
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  label,
  mobileLabel,
  className = '',
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  // 0464-d: 적용 불가 시 비활성(워드·한글 방식 — 눌러도 무반응보다 처음부터 회색이 납득).
  // native disabled라 mousedown 자체가 안 와서 아래 핸들러 가드 불요. 어휘는 기존
  // disabled:opacity-40 disabled:cursor-not-allowed(Pagination 선례) 재사용.
  // 0465 후속: opacity 단독은 이미 회색(fg2)인 아이콘의 다크 배경 대비 차가 작아 실기기
  // 식별 불가 — disabled:text-muted 색 강등 병행(비활성 = 콘텐츠 강등 축, 배경 채움은 선택/hover 축)
  disabled?: boolean;
  label?: string; // 아이콘만 있는 버튼용 — aria-label·title(툴팁) 겸용
  // 0468→0470: 모바일 라벨 버튼 — 지정 시 sm 미만에서 아이콘 아래 라벨(세로 배치).
  // 폭·높이는 2×3 그리드 셀 stretch가 결정(0470). 라벨 12px = §5 하한 준수. sm 이상 무변
  mobileLabel?: string;
  // 0461 반응형 표시·순서(order-N) 패스스루. 숨김은 반드시 max-sm:hidden —
  // 베이스에 inline-flex(display 유틸)가 있어 무접두 hidden은 v4 출력 순서(알파벳: h<i)상
  // 동특이도로 덮여 무효(0462 실측). 미디어 스코프 규칙은 베이스 뒤라 순서 무관하게 이김.
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // min 44px는 모바일 터치 타겟(§5), sm 이상은 기존 28px(포인터 환경 — 데스크톱 현행 유지 확정).
    // inline-flex 센터링: min-height에서 내용 수직 중앙을 브라우저 기본에 안 맡김(양 모드 동일 28px 계산 유지)
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`inline-flex items-center justify-center px-2 py-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded text-sm font-medium transition-colors disabled:opacity-40 disabled:text-muted disabled:cursor-not-allowed ${
        isActive ? 'bg-surface2 text-fg' : 'text-fg2 hover:bg-popover'
      // 폭·높이 유틸 없음(0470) — 2×3 그리드 셀이 결정(폭 ≈101px+·높이 55px, 컨테이너 주석
      // 참조). 0469의 max-sm:px-0(flex-1 53.6px 경계선 대응)은 셀 폭이 넉넉해져 px-2 복귀
      } ${mobileLabel ? 'max-sm:flex-col max-sm:gap-1' : ''} ${className}`}
    >
      {children}
      {/* whitespace-nowrap — 줄바꿈 봉인 안전망(사용자 지정 유지). 그리드 셀 폭 ≈101px+라 실발동 없음 */}
      {mobileLabel && <span className="sm:hidden whitespace-nowrap text-xs leading-none font-normal">{mobileLabel}</span>}
    </button>
  );
}

/* 툴바 그룹 구분선 — 색은 --divider 토큰(구분선 전용, 0345). --border는 1px 세로 조각에선
   식별 불가(헤어라인 알파가 긴 수평선 전제)라 별도 토큰. 폭 2px(w-0.5): 1px는 밝은 주변광에서
   다크 배경 반사 리프트에 묻힘(실측 — 색 레버는 아이콘 밝기 직전까지 소진). 장식이라 aria-hidden */
function ToolbarDivider() {
  // max-sm:hidden(0461·0462) — 모바일 한 줄(5버튼+더보기)엔 그룹이 없어 구분선 미표시.
  // 무접두 hidden 관용구는 이 파일에서 금지(ToolbarButton 주석의 v4 순서 함정) — 한 벌로 통일
  return <div aria-hidden className="max-sm:hidden w-0.5 self-stretch bg-divider" />;
}

export function TiptapEditor({ content, onChange, userId }: TiptapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 0468: 툴바 자리 스왑 뷰 — null=버튼 행, 'list'=공용 목록, 'format'=양식 선택.
  // 0463의 슬래시 억제 배선(moreOpenRef·slashCloseRef)은 제거 — 전제였던 "더보기 팝오버와
  // 오버레이 동시 표시"가 자리 스왑 전환으로 소멸(스왑은 오버레이가 아닌 툴바 상태).
  const [toolsView, setToolsView] = useState<null | 'list' | 'format'>(null);
  const toolbarRef = useRef<HTMLDivElement>(null); // 서식 진입 시 화면 밖이면 스크롤 유도(0468)

  // extensions 렌더 간 고정 — useEditor.compareOptions가 배열 항목 동일성(!==)으로 비교하는데
  // configure()·createSlashCommand() 재호출 산물은 매번 새 객체라 항상 불일치 판정 →
  // 매 렌더 setOptions()·view.updateState() 전체 재갱신이 일어나던 근본 원인.
  // 의존성 []인 근거: 외부 참조(슬래시 이미지 콜백)가 호출 시점에 .current만 읽는
  // 지연 참조라 1회 생성 클로저가 영구 유효. (openFormat 배선은 0471에서 제거)
  const extensions = useMemo(
    () => [
      StarterKit.configure({ link: false }),
      Image,
      Link.configure({ openOnClick: false }),
      Callout,
      SizeMark, // "작게" 마크 — <span data-size="sm">, 크기는 globals.css 파생
      // placeholder 확장 없음(0358) — 예시가 실제 텍스트(0355)라 본문 안 안내가 불필요하고,
      // 자유형·빈 본문 무문구가 확정 사양. 슬래시 안내는 에디터 밖 하단 보조 텍스트(StoryWriteForm).
      // react-hooks/refs 오탐: 세 ref 모두 렌더 중이 아니라 플러그인 콜백 호출 시점에만 읽힘
      // (위 "의존성 []인 근거" 참조). 이 disable로 기존 톨러레이트하던 이미지 콜백 오탐 1건도
      // 함께 침묵됨 — 이 줄에 실제 렌더 중 ref 접근을 추가하면 가려지므로 주의.
      // eslint-disable-next-line react-hooks/refs
      createSlashCommand(() => fileInputRef.current?.click()),
      GlobalDragHandle, // 기본 옵션(dragHandleWidth 20) — 아래 sm:pl-[38px]와 파생 관계
    ],
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // 활성 표시 구독(v3 권장 useEditorState) — 트랜잭션마다 셀렉터만 실행되고, 불리언 맵이
  // 실제로 바뀔 때만(deepEqual) 리렌더. v3 useEditor는 트랜잭션에 리렌더하지 않아 선택만으로는
  // isActive가 갱신되지 않던 문제의 해소 지점. 툴바·버블 메뉴가 이 한 맵을 공유한다.
  // 전량 리렌더(shouldRerenderOnTransaction)안은 무한 리렌더 사고로 기각 — extensions 고정(0457)과
  // 짝: 리렌더가 와도 setOptions 재실행이 없어 고리가 성립하지 않는다.
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            // isActive 맵(0469 단일 소스화) — 판정식은 ToolList.computeActiveMap 한 곳.
            // 툴바 버튼 isActive와 목록 행 체크마크가 같은 값으로 갱신된다
            ...computeActiveMap(e),
            // can 맵(0464-d→0468 단일 소스화) — 판정식은 ToolList.computeCanMap 한 곳.
            // 여기 spread는 값이 바뀔 때 deepEqual 리렌더를 트리거하는 역할(툴바 버튼 disabled +
            // 목록 항목 회색이 같은 값으로 갱신). tiptap canSetMark가 mark excludes를 반영
            // (코드 마크 전체 배제 "_")해 실질 발동은 선택 전체가 인라인 코드일 때, 블록·콜아웃은
            // 스키마 제약(콜아웃 content: paragraph+, 중첩 금지) 반영.
            ...computeCanMap(e),
          }
        : null,
  });

  if (!editor) return null;

  // 서식 진입(0468) — 목록·슬래시 공용. 툴바 자리 format 뷰로 스왑하고, 실행 지점(슬래시·
  // 선택 목록)이 문서 중간이라 툴바가 화면 밖이면 "아무 일도 안 일어난 것처럼" 보이는 문제를
  // scrollIntoView로 완화(사용자 지정 검수 항목). rAF = 뷰 렌더 반영 후 스크롤.
  function openFormat() {
    setToolsView('format');
    requestAnimationFrame(() => toolbarRef.current?.scrollIntoView({ block: 'nearest' }));
  }

  function handleImageUpload() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    try {
      const url = await uploadStoryImage(file, userId);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      alert('이미지 업로드에 실패했습니다.');
    }

    e.target.value = '';
  }

  // 공용 목록 항목(0468→0471 이원화) — 리렌더 트리거는 useEditorState 맵(active),
  // 판정식은 computeCanMap·computeActiveMap 단일 소스라 항목 disabled·active가 같은 값.
  // toolItems(⋯ 스왑 전용)만 onFormat을 전달 — 서식의 유일 잔존 진입점(0471, 글 시작
  // 1회성이라 선택·슬래시 맥락 제외). selectionItems(선택 BubbleMenu)는 서식 미포함.
  // react-hooks/refs 오탐: 핸들러는 렌더 중 호출되지 않고 항목 클릭 시점에만 실행돼
  // ref를 읽는다(위 extensions 이미지 콜백 오탐과 동일 유형 — 지연 참조).
  // eslint-disable-next-line react-hooks/refs
  const toolItems = active ? buildToolItems(active, { onImagePick: handleImageUpload, onFormat: openFormat }) : [];
  // eslint-disable-next-line react-hooks/refs
  const selectionItems = active ? buildToolItems(active, { onImagePick: handleImageUpload }) : [];

  return (
    // 테두리 복원(0364, 현우 결정) — 툴바+본문을 한 상자로. 본문 영역의 끝이 모호하던 문제를
    // 상자로 닫고, 본문 시작선이 제목·태그와 어긋나는 것(pl만큼)은 수용. 배경은 여전히 페이지
    // 배경(0319의 bg 제거 유지) — 선만 두르고 면은 칠하지 않음. radius는 팝오버·버블 메뉴와
    // 같은 10px 카드 어휘. 포커스 링 없음(0344) — 포커스 신호는 캐럿·툴바 활성으로 유지.
    <div className="rounded-[10px] border border-border">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* 툴바(0468 자리 스왑) — 모바일 높이 131px 고정(사용자 설계): ⋯ 목록 스왑과 높이가
          같아 교체 시 본문 밀림 0. 구성 131 = p-2(16) + ToolList(헤더44+구분선1+스크롤70) —
          ToolList 헤더 주석과 짝(한쪽만 바꾸면 어긋남). format 뷰만 내용상 131을 넘을 수 있어
          고정 해제(양식 5종+확인, 전체 교체 흐름 한정). 데스크톱(sm+)은 현행 자동 높이 유지 */}
      <div
        ref={toolbarRef}
        className={`border-b border-border ${toolsView === 'format' ? '' : 'max-sm:h-[131px]'}`}
      >
      {toolsView === 'list' ? (
        // ⋯ 스왑 뷰 — 팝오버가 아니라 툴바 내용 교체(0468, 오버레이 아님), ✕로 버튼 뷰 복귀.
        // 항목 실행 후에도 버튼 뷰 복귀(구 ToolbarMore 실행 후 닫힘 승계).
        // 순서 주의(0471): 복귀(null)를 먼저, 실행을 나중에 — 서식 항목의 run이
        // setToolsView('format')이라, 실행 후 null을 부르면 같은 이벤트 배칭에서 마지막
        // 호출(null)이 이겨 format 뷰가 즉시 덮였다(⋯ 목록 서식이 무동작이던 원인)
        <div className="p-2">
          <ToolList
            items={toolItems}
            command={(item) => {
              setToolsView(null);
              item.run(editor);
            }}
            onClose={() => setToolsView(null)}
          />
        </div>
      ) : toolsView === 'format' ? (
        // 서식 뷰 — 같은 자리 내용 전환(0359 패턴 승계). autoFocus false: 에디터 포커스·iOS
        // 선택 표시 보존(0467 원칙 — 서식은 선택과 무관하지만 취소 복귀 대비 일관 유지)
        <div className="p-2">
          {/* 모바일엔 ESC가 없어 터치용 뒤로 행 필수(구 ToolbarMore 서식 뷰 승계) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setToolsView('list')}
            className="flex w-full items-center gap-1.5 min-h-[44px] rounded px-2 text-sm text-fg2 hover:bg-popover transition-colors"
          >
            <ArrowLeft size={14} />
            뒤로
          </button>
          <FormatMenuContent
            editor={editor}
            autoFocus={false}
            onDone={() => setToolsView(null)}
            onEscape={() => setToolsView('list')}
          />
        </div>
      ) : (
      /* 버튼 뷰 — 데스크톱(sm+) 3그룹: 블록 서식 │ 인라인 서식 │ 삽입(현행 유지, 0461 확정).
          본문 H1 버튼 없음 — 페이지 제목 input이 최상위(0332 h1=h2 병합).
          모바일(sm 미만, 0470 그리드·0471 구성): 2×3 — 1행 제목·굵게·작게 / 2행 사진·서식·더보기.
          기울임·목록은 ⋯ 목록으로 강등(0471) — 서식이 글 시작 필수 동선이라 툴바 승격.
          0469 한 줄 flex-1(53.6px)에서 "더보기" 라벨이 nowrap으로 우측 삐져나오고 131px
          하단이 비던 두 문제를 함께 해소(셀 폭 ≈101px+, 두 행이 h-full 등분).
          grid-rows-2 필수 — 암시적 행은 auto 높이라 h-full을 안 나눔. items-center 금지 —
          align-items는 grid에도 적용돼 stretch(셀 채움 = 터치 면적)를 깬다.
          그리드 자동 배치가 order-1~6을 반영하므로 DOM 순서(데스크톱 그룹 기준)는 그대로,
          max-sm:hidden 항목·구분선은 셀 미점유. 접힘 항목·서식은 ⋯ 스왑 목록이 유일 진입점 */
      <div className="p-2 flex gap-1 flex-wrap max-sm:grid max-sm:h-full max-sm:grid-cols-3 max-sm:grid-rows-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={active?.heading2}
          disabled={active?.canHeading2 === false}
          label="제목"
          mobileLabel="제목"
          className="order-1 sm:order-none"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={active?.heading3}
          disabled={active?.canHeading3 === false}
          label="소제목"
          className="max-sm:hidden"
        >
          H3
        </ToolbarButton>
        {/* 작게(SizeMark) — 사용자 인식은 "글자 크기 조절"이라 헤딩 옆 배치. 단 구분선
            양쪽 샌드위치로 헤딩(좌)·블록(우) 어느 계열로도 오해되지 않게 격리 */}
        <ToolbarDivider />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleSmall().run()}
          isActive={active?.size}
          disabled={active?.canSize === false}
          label="작게"
          mobileLabel="작게"
          className="order-3 sm:order-none"
        >
          <AArrowDown size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={active?.bulletList}
          disabled={active?.canBulletList === false}
          label="목록"
          className="max-sm:hidden"
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={active?.blockquote}
          disabled={active?.canBlockquote === false}
          label="인용"
          className="max-sm:hidden"
        >
          <Quote size={16} />
        </ToolbarButton>
        {/* 콜아웃 3종 — 블록 구조 계열이라 그룹1(인용 옆). 삽입 그룹(3)은 외부 자산 어휘라 부적합 */}
        <ToolbarButton
          onClick={() => editor.chain().focus().insertCallout('tip').run()}
          isActive={active?.calloutTip}
          disabled={active?.canCallout === false}
          label="팁 콜아웃"
          className="max-sm:hidden"
        >
          <Lightbulb size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().insertCallout('faq').run()}
          isActive={active?.calloutFaq}
          disabled={active?.canCallout === false}
          label="FAQ 콜아웃"
          className="max-sm:hidden"
        >
          <MessageCircleQuestion size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().insertCallout('warn').run()}
          isActive={active?.calloutWarn}
          disabled={active?.canCallout === false}
          label="주의 콜아웃"
          className="max-sm:hidden"
        >
          <TriangleAlert size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={active?.bold}
          disabled={active?.canBold === false}
          label="굵게"
          mobileLabel="굵게"
          className="order-2 sm:order-none"
        >
          B
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={active?.italic}
          disabled={active?.canItalic === false}
          label="기울임"
          className="max-sm:hidden"
        >
          I
        </ToolbarButton>
        {/* 취소선·인라인 코드 = StarterKit 기등록 마크의 UI 노출 */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={active?.strike}
          disabled={active?.canStrike === false}
          label="취소선"
          className="max-sm:hidden"
        >
          <Strikethrough size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={active?.code}
          disabled={active?.canCode === false}
          label="인라인 코드"
          className="max-sm:hidden"
        >
          <Code size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => promptLink(editor)}
          isActive={active?.link}
          disabled={active?.canLink === false}
          label="링크"
          className="max-sm:hidden"
        >
          <LinkIcon size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton onClick={handleImageUpload} label="이미지" mobileLabel="사진" className="order-4 sm:order-none">
          <ImageIcon size={16} />
        </ToolbarButton>
        {/* 3b: 서식 팝오버 — ml-auto로 우측 끝 분리(삽입 성격이 달라 다른 그룹과 구분).
            데스크톱 전용 — 모바일은 아래 전용 버튼(0471)이 담당 */}
        <FormatMenu editor={editor} />
        {/* 서식(0471) — 모바일 전용, openFormat 직행으로 format 뷰 스왑(0468 방식).
            ⋯ 목록 command 래퍼를 안 거치므로 래퍼 덮어쓰기 원인이 이 경로엔 없음.
            아이콘은 데스크톱 FormatMenu 트리거와 동일(LayoutTemplate 16) */}
        <ToolbarButton onClick={openFormat} label="서식" mobileLabel="서식" className="order-5 sm:hidden">
          <LayoutTemplate size={16} />
        </ToolbarButton>
        {/* 더보기(0468) — 모바일 전용, 팝오버(구 ToolbarMore) 대신 툴바 자리 스왑 트리거 */}
        <ToolbarButton onClick={() => setToolsView('list')} label="더보기" mobileLabel="더보기" className="order-6 sm:hidden">
          <Ellipsis size={16} />
        </ToolbarButton>
      </div>
      )}
      </div>
      {/* 선택 목록(0468) — 텍스트를 선택하면 ⋯를 거치지 않고 공용 목록이 바로 뜬다(구 버블
          마크 버튼 바 제거). 툴바를 쓰러 위로 스크롤하면 화면이 흔들려 집중이 끊기는 것이
          선택 자리에서 바로 띄우는 이유(사용자 확정). BubbleMenu 컴포넌트는 유지 — 선택
          감지(shouldShow)·선택 rect 포지셔닝·선택 해제 시 닫힘·mousedown preventHide를 이미
          해결한 층이라 컨테이너로 재사용, 내용만 목록으로 교체. auto-focus 전무라 에디터
          포커스·iOS 선택 표시 보존(0467). ✕는 hide 메타 — 다음 선택 변경 시 재표시(사양) */}
      <BubbleMenu
        editor={editor}
        pluginKey="selection-tools"
        options={{ offset: 8, placement: 'top' }}
        shouldShow={({ editor: e, state }) =>
          !state.selection.empty && !e.isActive('image') // 빈 선택·이미지 노드 선택 시 숨김
        }
        className={TOOL_SHELL}
      >
        <ToolList
          items={selectionItems}
          command={(item) => item.run(editor)}
          onClose={() => editor.view.dispatch(editor.state.tr.setMeta('selection-tools', 'hide'))}
        />
      </BubbleMenu>
      {/* 핸들 gutter 복원(0364) — 드래그 핸들은 텍스트 왼쪽 밖 [node.left-20, node.left] 20px
          구간에 뜨므로(패키지: style.left = rect.left - dragHandleWidth, 폭은 .drag-handle 20px 동기)
          상자를 두르면 pl ≥ 20이어야 테두리를 안 침범. sm:pl-[38px] = 0341 이전 카드 시절 파생값
          복원(핸들 20 + 여유 18 → 핸들이 상자 안 [18,38] 구간, li 핸들도 [22,42]로 내부).
          모바일은 hover 없어 핸들 미표시라 pl-4(상자 내부 숨통)만. pr-4는 우측 대칭 숨통.
          0363의 border-b(하한선)는 상자 하단이 역할을 대체해 제거. */}
      {/* [&_.ProseMirror]:outline-none = 편집영역 포커스 시 브라우저 기본 파란 아웃라인 제거.
          (래퍼의 focus-within:outline-none은 정작 포커스 받는 안쪽 .ProseMirror엔 안 먹어 남던 테두리) */}
      <EditorContent
        editor={editor}
        className="tiptap-content min-h-[260px] py-3 pl-4 pr-4 sm:pl-[38px] text-base leading-relaxed focus-within:outline-none [&_.ProseMirror]:outline-none"
      />
    </div>
  );
}
