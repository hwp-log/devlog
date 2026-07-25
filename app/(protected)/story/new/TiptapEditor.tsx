'use client';
import { useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
// tiptap 확장 Link·Image와 이름 충돌 — 별칭 필수
import {
  Image as ImageIcon, Link as LinkIcon, List, Quote,
  Lightbulb, MessageCircleQuestion, TriangleAlert,
} from 'lucide-react';
import { uploadStoryImage } from '@/lib/supabase/storage';
import { Callout } from './Callout';
import { createSlashCommand } from './SlashCommand';
import { FormatMenu } from './FormatMenu';

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  userId: string;
}

function ToolbarButton({
  onClick,
  isActive,
  label,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  label?: string; // 아이콘만 있는 버튼용 — aria-label·title(툴팁) 겸용
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
        isActive ? 'bg-surface2 text-fg' : 'text-fg2 hover:bg-popover'
      }`}
    >
      {children}
    </button>
  );
}

/* 툴바 그룹 구분선 — 색은 --divider 토큰(구분선 전용, 0345). --border는 1px 세로 조각에선
   식별 불가(헤어라인 알파가 긴 수평선 전제)라 별도 토큰. 폭 2px(w-0.5): 1px는 밝은 주변광에서
   다크 배경 반사 리프트에 묻힘(실측 — 색 레버는 아이콘 밝기 직전까지 소진). 장식이라 aria-hidden */
function ToolbarDivider() {
  return <div aria-hidden className="w-0.5 self-stretch bg-divider" />;
}

export function TiptapEditor({ content, onChange, userId }: TiptapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Image,
      Link.configure({ openOnClick: false }),
      Callout,
      // placeholder 확장 없음(0358) — 예시가 실제 텍스트(0355)라 본문 안 안내가 불필요하고,
      // 자유형·빈 본문 무문구가 확정 사양. 슬래시 안내는 에디터 밖 하단 보조 텍스트(StoryWriteForm).
      createSlashCommand(() => fileInputRef.current?.click()),
      GlobalDragHandle, // 기본 옵션(dragHandleWidth 20) — 아래 sm:pl-[38px]와 파생 관계
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
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
      {/* 3그룹: 블록 서식 │ 인라인 서식 │ 삽입. 본문 H1 버튼 없음 — 페이지 제목 input이 최상위(0332 h1=h2 병합).
          H2·H3·B·I는 텍스트(서식 버튼 관례), 나머지는 lucide 아이콘으로 통일 */}
      <div className="border-b border-border p-2 flex gap-1 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          label="목록"
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          label="인용"
        >
          <Quote size={16} />
        </ToolbarButton>
        {/* 콜아웃 3종 — 블록 구조 계열이라 그룹1(인용 옆). 삽입 그룹(3)은 외부 자산 어휘라 부적합 */}
        <ToolbarButton
          onClick={() => editor.chain().focus().insertCallout('tip').run()}
          isActive={editor.isActive('callout', { kind: 'tip' })}
          label="팁 콜아웃"
        >
          <Lightbulb size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().insertCallout('faq').run()}
          isActive={editor.isActive('callout', { kind: 'faq' })}
          label="FAQ 콜아웃"
        >
          <MessageCircleQuestion size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().insertCallout('warn').run()}
          isActive={editor.isActive('callout', { kind: 'warn' })}
          label="주의 콜아웃"
        >
          <TriangleAlert size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
        >
          B
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
        >
          I
        </ToolbarButton>
        <ToolbarButton
          onClick={handleLink}
          isActive={editor.isActive('link')}
          label="링크"
        >
          <LinkIcon size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton onClick={handleImageUpload} label="이미지">
          <ImageIcon size={16} />
        </ToolbarButton>
        {/* 3b: 서식 팝오버 — ml-auto로 우측 끝 분리(삽입 성격이 달라 다른 그룹과 구분) */}
        <FormatMenu editor={editor} />
      </div>
      {/* 버블 메뉴 — 선택 서식(B/I/H2/링크). 껍데기와 같은 어휘(bg-card·border-border·라운드)+그림자.
          이미지는 선택 서식이 아니라 제외. 상단 툴바와 하이브리드(둘 다 유지). */}
      <BubbleMenu
        editor={editor}
        options={{ offset: 8, placement: 'top' }}
        shouldShow={({ editor: e, state }) =>
          !state.selection.empty && !e.isActive('image') // 빈 선택·이미지 노드 선택 시 숨김
        }
        className="flex gap-1 rounded-[10px] border-[0.5px] border-border bg-card p-1 shadow-lg"
      >
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')}>
          B
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')}>
          I
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
        >
          H2
        </ToolbarButton>
        <ToolbarButton onClick={handleLink} isActive={editor.isActive('link')} label="링크">
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
