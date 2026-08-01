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
  Strikethrough, Code, AArrowDown,
} from 'lucide-react';
import { uploadStoryImage } from '@/lib/supabase/storage';
import { Callout } from './Callout';
import { SizeMark } from './SizeMark';
import { createSlashCommand } from './SlashCommand';
import { FormatMenu } from './FormatMenu';
import { ToolbarMore } from './ToolbarMore';
import { BubbleMore } from './BubbleMore';

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
  // 0461 반응형 표시·순서(order-N) 패스스루. 숨김은 반드시 max-sm:hidden —
  // 베이스에 inline-flex(display 유틸)가 있어 무접두 hidden은 v4 출력 순서(알파벳: h<i)상
  // 동특이도로 덮여 무효(0462 실측). 미디어 스코프 규칙은 베이스 뒤라 순서 무관하게 이김.
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // min 44px는 모바일 터치 타겟(§5), sm 이상은 기존 28px(포인터 환경 — 데스크톱 현행 유지 확정).
    // 버블 메뉴도 이 컴포넌트 공유라 모바일 버블 버튼이 함께 44px — 의도된 §5 파급(0461 plan).
    // inline-flex 센터링: min-height에서 내용 수직 중앙을 브라우저 기본에 안 맡김(양 모드 동일 28px 계산 유지)
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`inline-flex items-center justify-center px-2 py-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded text-sm font-medium transition-colors disabled:opacity-40 disabled:text-muted disabled:cursor-not-allowed ${
        isActive ? 'bg-surface2 text-fg' : 'text-fg2 hover:bg-popover'
      } ${className}`}
    >
      {children}
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
  // 0464-b: 버블 ⋯ 목록 열림 여부 — 열림 중 버블 메뉴를 invisible 처리(오버레이 단일화)
  const [bubbleListOpen, setBubbleListOpen] = useState(false);
  // 0463: 더보기 패널·슬래시 메뉴 동시 표시 방지 배선 — 지연 참조 ref 2개.
  // 읽기·쓰기 전부 이벤트 핸들러·플러그인 콜백 시점(렌더 중 접근 없음). useMemo 고정 객체
  // 대안은 react-hooks/immutability(훅 산출물 변경 금지)에 걸려 기각 — 가변 비렌더 상태는 ref가 정위치.
  const moreOpenRef = useRef(false); // 더보기 패널(툴바·버블 어느 쪽이든) 열림 여부
  const slashCloseRef = useRef<(() => void) | null>(null); // 열린 슬래시 메뉴의 destroy 핸들

  // extensions 렌더 간 고정 — useEditor.compareOptions가 배열 항목 동일성(!==)으로 비교하는데
  // configure()·createSlashCommand() 재호출 산물은 매번 새 객체라 항상 불일치 판정 →
  // 매 렌더 setOptions()·view.updateState() 전체 재갱신이 일어나던 근본 원인.
  // 의존성 []인 근거: 외부 참조(슬래시 이미지 콜백·moreOpenRef·slashCloseRef)가 전부
  // 호출 시점에 .current를 읽는 지연 참조라(ref 객체는 렌더 간 안정) 1회 생성 클로저가 영구 유효.
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
      createSlashCommand(() => fileInputRef.current?.click(), () => moreOpenRef.current, slashCloseRef),
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
            // can 맵(0464-d) — "현재 선택에 적용 불가"의 단일 소스. tiptap canSetMark가
            // mark excludes를 반영(코드 마크가 전체 배제 "_")해 실질 발동은 선택 전체가
            // 인라인 코드일 때. 범위 선택은 적용 가능 노드가 하나라도 있으면 true(부분 겹침 활성).
            // 블록 4종·콜아웃은 스키마 제약(콜아웃 content: paragraph+, 중첩 금지) 반영.
            canBold: e.can().toggleBold(),
            canItalic: e.can().toggleItalic(),
            canStrike: e.can().toggleStrike(),
            canCode: e.can().toggleCode(),
            // 작게×제목은 PM 무차단인 우리 문제(13px 고정이 제목 크기를 이김) — 여기서 금지 확정.
            // globals.css의 제목 안 [data-size] 가드와 짝(기존 저장 글 표시 정상화는 CSS 몫)
            canSize: e.can().toggleSmall() && !e.isActive('heading'),
            canLink: e.can().setMark('link'), // setLink는 href 검증이 겹쳐 setMark로 canSetMark만 판단
            canHeading2: e.can().toggleHeading({ level: 2 }),
            canHeading3: e.can().toggleHeading({ level: 3 }),
            canBulletList: e.can().toggleBulletList(),
            canBlockquote: e.can().toggleBlockquote(),
            canCallout: e.can().insertCallout('tip'), // 콜아웃 안 재삽입 금지(Callout.ts 명시 false) — kind 무관
          }
        : null,
  });

  if (!editor) return null;

  function handleLink() {
    if (!editor) return;
    const url = window.prompt('URL을 입력하세요:');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  }

  function handleImageUpload() {
    fileInputRef.current?.click();
  }

  // 0463: 패널 열림 통지 — 열리는 순간 열려 있던 슬래시 메뉴를 닫고(destroy, ESC와 동일 경로),
  // 열림 동안 moreOpenRef가 슬래시 allow를 억제한다. 툴바 ToolbarMore·버블 BubbleMore 공용.
  function handleMoreOpenChange(open: boolean) {
    moreOpenRef.current = open;
    if (open) slashCloseRef.current?.();
  }

  // 0464-b: 버블 목록 열림 중 버블 숨김 — 버블 인스턴스 전용(툴바 패널은 버블과 별개 오버레이라
  // 기존 handleMoreOpenChange 그대로). 숨김은 visibility(레이아웃 보존)로 — ⋯ 트리거·목록이
  // 버블의 자식이라 shouldShow·언마운트로 숨기면 목록까지 사라지고, rect가 유지돼야
  // floating-ui 앵커가 흔들리지 않는다. BubbleMore의 통지가 클린업 경유라 선택 붕괴로
  // 버블이 내려가 언마운트돼도 false가 보장됨(invisible 잔류 없음).
  // 0464-d: blur 시도(0464-c) 제거 — iOS 자체 선택 메뉴는 웹에서 차단 불가 확정
  // (-webkit-touch-callout iOS15+ 미동작 실기기 확인), blur는 선택을 깨뜨려 기각. 겹침 수용.
  function handleBubbleMoreOpenChange(open: boolean) {
    setBubbleListOpen(open);
    handleMoreOpenChange(open); // 슬래시 억제 배선(0463)은 그대로 승계
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
      {/* 데스크톱(sm+) 3그룹: 블록 서식 │ 인라인 서식 │ 삽입 — 현행 유지(0461 확정). 본문 H1 버튼
          없음 — 페이지 제목 input이 최상위(0332 h1=h2 병합). H2·H3·B·I는 텍스트(서식 버튼 관례).
          모바일(sm 미만, 0461 점진 공개): H2·B·I·목록·이미지 + 더보기 한 줄 — 슬래시로 대체
          가능한 블록은 접고, 진입점이 툴바·버블뿐인 마크(B·I)를 남김(사용자 확정). DOM 순서는
          데스크톱 그룹 기준이라 모바일 순서는 order-1~6으로 부여(sm:order-none 복원).
          접힘 9종 + 서식은 ToolbarMore 팝오버로 — H3·취소선·코드는 그 패널이 유일 진입점 */}
      <div className="border-b border-border p-2 flex gap-1 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={active?.heading2}
          disabled={active?.canHeading2 === false}
          label="제목"
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
          className="max-sm:hidden"
        >
          <AArrowDown size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={active?.bulletList}
          disabled={active?.canBulletList === false}
          label="목록"
          className="order-4 sm:order-none"
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
          className="order-2 sm:order-none"
        >
          B
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={active?.italic}
          disabled={active?.canItalic === false}
          label="기울임"
          className="order-3 sm:order-none"
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
          onClick={handleLink}
          isActive={active?.link}
          disabled={active?.canLink === false}
          label="링크"
          className="max-sm:hidden"
        >
          <LinkIcon size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton onClick={handleImageUpload} label="이미지" className="order-5 sm:order-none">
          <ImageIcon size={16} />
        </ToolbarButton>
        {/* 3b: 서식 팝오버 — ml-auto로 우측 끝 분리(삽입 성격이 달라 다른 그룹과 구분).
            모바일은 더보기 안 FormatMenuContent가 대체(0461)라 데스크톱 전용 */}
        <FormatMenu editor={editor} />
        {/* 더보기(0461) — 모바일 전용. ml-auto 없음(0463): flex-wrap에서 auto 마진이 더보기를
            다음 줄로 밀던 원인 — 좌측 연속 배치로 6개 한 줄(284px ≤ 360px 가용 294) */}
        <ToolbarMore editor={editor} active={active} onLink={handleLink} onOpenChange={handleMoreOpenChange} className="order-6 sm:hidden" />
      </div>
      {/* 버블 메뉴 — 선택 서식(B/I/H2/작게/링크). 껍데기와 같은 어휘(bg-card·border-border·라운드)+그림자.
          이미지는 선택 서식이 아니라 제외. 상단 툴바와 하이브리드(둘 다 유지). */}
      <BubbleMenu
        editor={editor}
        options={{ offset: 8, placement: 'top' }}
        shouldShow={({ editor: e, state }) =>
          !state.selection.empty && !e.isActive('image') // 빈 선택·이미지 노드 선택 시 숨김
        }
        // invisible!(0464-c) — 목록 열림 중 버블 숨김. !important 필수: BubbleMenuView가
        // show()·updatePosition()마다 같은 엘리먼트에 inline style visibility:visible을 재설정해
        // 무접미 invisible은 항상 짐(0464-b가 무효였던 원인). visibility라 레이아웃·트리거 rect 보존
        // (목록 앵커 무이동), 자식인 목록 팝오버는 자체 visibility:visible로 역전해 살아남는다
        // (!important는 같은 엘리먼트 캐스케이드에만 작용, 상속엔 전파 안 됨)
        className={`flex gap-1 rounded-[10px] border-[0.5px] border-border bg-card p-1 shadow-lg ${bubbleListOpen ? 'invisible!' : ''}`}
      >
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} disabled={active?.canBold === false} isActive={active?.bold} label="굵게">
          B
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} disabled={active?.canItalic === false} isActive={active?.italic} label="기울임">
          I
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={active?.heading2}
          label="제목"
          disabled={active?.canHeading2 === false}
        >
          H2
        </ToolbarButton>
        {/* 작게 — 선택 후 즉시 거는 성격이라 버블이 주 진입점(툴바와 동일 아이콘·라벨) */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleSmall().run()} disabled={active?.canSize === false} isActive={active?.size} label="작게">
          <AArrowDown size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={handleLink} disabled={active?.canLink === false} isActive={active?.link} label="링크">
          <LinkIcon size={16} />
        </ToolbarButton>
        {/* 더보기(0463·0464) — 모바일에서 버블이 실질 주 경로인데 접힌 항목 진입로가 없던 것을
            해소. 데스크톱 버블에도 표시: 툴바가 문서 상단 in-flow(비고정)라 긴 글 중간에선
            데스크톱도 같은 스크롤 이탈 문제 — 두 환경 버블 구성 한 벌 유지. H2가 버블에 남는
            이유도 동일 전제(노션은 키보드 위 상시 툴바, 우리는 상단 비고정 — 사용자 확정).
            내용은 툴바 그리드가 아닌 버블 전용 선택 도구 목록(BubbleMore, 0464) — 버블은
            "이미 있는 글의 변환" 자리라 마크 4종+블록 변환 4종만.
            구분선은 인라인 div — ToolbarDivider는 max-sm:hidden이라 모바일 표시가 필요한 버블엔 부적합 */}
        <div aria-hidden className="w-0.5 self-stretch bg-divider" />
        <BubbleMore editor={editor} active={active} onLink={handleLink} onOpenChange={handleBubbleMoreOpenChange} />
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
