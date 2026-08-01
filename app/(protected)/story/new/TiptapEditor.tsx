'use client';
import { useMemo, useRef } from 'react';
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

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  userId: string;
}

function ToolbarButton({
  onClick,
  isActive,
  label,
  className = '',
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  label?: string; // 아이콘만 있는 버튼용 — aria-label·title(툴팁) 겸용
  className?: string; // 0461: 반응형 표시(hidden sm:inline-flex)·순서(order-N) 제어용 패스스루
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
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`inline-flex items-center justify-center px-2 py-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded text-sm font-medium transition-colors ${
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
  // hidden sm:block(0461) — 모바일 한 줄(5버튼+더보기)엔 그룹이 없어 구분선 미표시
  return <div aria-hidden className="hidden sm:block w-0.5 self-stretch bg-divider" />;
}

export function TiptapEditor({ content, onChange, userId }: TiptapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // extensions 렌더 간 고정 — useEditor.compareOptions가 배열 항목 동일성(!==)으로 비교하는데
  // configure()·createSlashCommand() 재호출 산물은 매번 새 객체라 항상 불일치 판정 →
  // 매 렌더 setOptions()·view.updateState() 전체 재갱신이 일어나던 근본 원인.
  // 의존성 []인 근거: 유일한 외부 참조(슬래시 이미지 콜백)가 ref를 호출 시점에 읽는
  // 지연 참조라(ref 객체는 렌더 간 안정) 1회 생성 클로저가 영구 유효.
  const extensions = useMemo(
    () => [
      StarterKit.configure({ link: false }),
      Image,
      Link.configure({ openOnClick: false }),
      Callout,
      SizeMark, // "작게" 마크 — <span data-size="sm">, 크기는 globals.css 파생
      // placeholder 확장 없음(0358) — 예시가 실제 텍스트(0355)라 본문 안 안내가 불필요하고,
      // 자유형·빈 본문 무문구가 확정 사양. 슬래시 안내는 에디터 밖 하단 보조 텍스트(StoryWriteForm).
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
          label="제목"
          className="order-1 sm:order-none"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={active?.heading3}
          label="소제목"
          className="hidden sm:inline-flex"
        >
          H3
        </ToolbarButton>
        {/* 작게(SizeMark) — 사용자 인식은 "글자 크기 조절"이라 헤딩 옆 배치. 단 구분선
            양쪽 샌드위치로 헤딩(좌)·블록(우) 어느 계열로도 오해되지 않게 격리 */}
        <ToolbarDivider />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleSmall().run()}
          isActive={active?.size}
          label="작게"
          className="hidden sm:inline-flex"
        >
          <AArrowDown size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={active?.bulletList}
          label="목록"
          className="order-4 sm:order-none"
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={active?.blockquote}
          label="인용"
          className="hidden sm:inline-flex"
        >
          <Quote size={16} />
        </ToolbarButton>
        {/* 콜아웃 3종 — 블록 구조 계열이라 그룹1(인용 옆). 삽입 그룹(3)은 외부 자산 어휘라 부적합 */}
        <ToolbarButton
          onClick={() => editor.chain().focus().insertCallout('tip').run()}
          isActive={active?.calloutTip}
          label="팁 콜아웃"
          className="hidden sm:inline-flex"
        >
          <Lightbulb size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().insertCallout('faq').run()}
          isActive={active?.calloutFaq}
          label="FAQ 콜아웃"
          className="hidden sm:inline-flex"
        >
          <MessageCircleQuestion size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().insertCallout('warn').run()}
          isActive={active?.calloutWarn}
          label="주의 콜아웃"
          className="hidden sm:inline-flex"
        >
          <TriangleAlert size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={active?.bold}
          label="굵게"
          className="order-2 sm:order-none"
        >
          B
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={active?.italic}
          label="기울임"
          className="order-3 sm:order-none"
        >
          I
        </ToolbarButton>
        {/* 취소선·인라인 코드 = StarterKit 기등록 마크의 UI 노출 */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={active?.strike}
          label="취소선"
          className="hidden sm:inline-flex"
        >
          <Strikethrough size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={active?.code}
          label="인라인 코드"
          className="hidden sm:inline-flex"
        >
          <Code size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleLink}
          isActive={active?.link}
          label="링크"
          className="hidden sm:inline-flex"
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
        {/* 더보기(0461) — 모바일 전용, ml-auto 우측 끝(이미지와의 여백 슬랙 흡수) */}
        <ToolbarMore editor={editor} active={active} onLink={handleLink} className="order-6 ml-auto sm:hidden" />
      </div>
      {/* 버블 메뉴 — 선택 서식(B/I/H2/작게/링크). 껍데기와 같은 어휘(bg-card·border-border·라운드)+그림자.
          이미지는 선택 서식이 아니라 제외. 상단 툴바와 하이브리드(둘 다 유지). */}
      <BubbleMenu
        editor={editor}
        options={{ offset: 8, placement: 'top' }}
        shouldShow={({ editor: e, state }) =>
          !state.selection.empty && !e.isActive('image') // 빈 선택·이미지 노드 선택 시 숨김
        }
        className="flex gap-1 rounded-[10px] border-[0.5px] border-border bg-card p-1 shadow-lg"
      >
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={active?.bold} label="굵게">
          B
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={active?.italic} label="기울임">
          I
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={active?.heading2}
          label="제목"
        >
          H2
        </ToolbarButton>
        {/* 작게 — 선택 후 즉시 거는 성격이라 버블이 주 진입점(툴바와 동일 아이콘·라벨) */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleSmall().run()} isActive={active?.size} label="작게">
          <AArrowDown size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={handleLink} isActive={active?.link} label="링크">
          <LinkIcon size={16} />
        </ToolbarButton>
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
