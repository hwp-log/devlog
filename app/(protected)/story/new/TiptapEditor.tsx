'use client';
import { useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
// tiptap 확장 Link·Image와 이름 충돌 — 별칭 필수
import { Image as ImageIcon, Link as LinkIcon, List, Quote } from 'lucide-react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { uploadStoryImage } from '@/lib/supabase/storage';
import { createSlashCommand } from './SlashCommand';
import { STORY_TEMPLATE_SECTIONS } from '@/lib/story/template';

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  userId: string;
}

// 빈 문단 바로 앞의 H2 제목 텍스트를 찾는다 (top-level 자식만 순회).
// placeholder 매칭이 heading 텍스트 기준이므로, 사용자가 H2 제목을 직접 바꾸면
// 매칭이 끊겨 기본(도입부) 문구로 떨어진다 — 자기 제목을 쓴 것이므로 의도된 동작.
function precedingHeadingText(doc: ProseMirrorNode, pos: number): string | null {
  let heading: string | null = null;
  doc.forEach((node, offset) => {
    if (offset < pos && node.type.name === 'heading') heading = node.textContent;
  });
  return heading;
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

/* 툴바 그룹 구분선 — 색은 --border 토큰(bg-border 유틸), 장식이라 aria-hidden */
function ToolbarDivider() {
  return <div aria-hidden className="w-px self-stretch bg-border" />;
}

export function TiptapEditor({ content, onChange, placeholder, userId }: TiptapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({
        // 프리필 골격의 각 빈 문단에 섹션별 안내를 띄우려면 포커스 노드 한정을 해제.
        // 빈 문단이면 앞 H2로 섹션 질문을 매핑, 없으면(도입부·기타) 기본 문구.
        showOnlyCurrent: false,
        placeholder: ({ editor, pos }) =>
          STORY_TEMPLATE_SECTIONS.find(
            (s) => s.heading === precedingHeadingText(editor.state.doc, pos),
          )?.prompt ?? (placeholder ?? '내용을 입력하세요...'),
      }),
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
    <div className="border-[0.5px] border-border rounded-[10px] bg-card">
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
        {/* 3단계: 서식 버튼 자리 — 우측 끝 */}
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
      {/* sm:pl-[38px] = 핸들 gutter — dragHandleWidth 20이 카드 안 [18,38]에 정착 (한쪽만 바꾸면 카드 밖 돌출). 모바일은 hover 없어 gutter 불요 */}
      {/* [&_p.is-empty]:before:* = 프리필 골격의 빈 문단 placeholder 렌더. globals.css는
          p.is-editor-empty:first-child(전체 빈 에디터 첫 문단)만 그리므로, 비지 않은 문서 속
          빈 문단(is-empty)은 여기서 렌더 (globals.css 규칙과 동일 스타일). */}
      <EditorContent
        editor={editor}
        className="tiptap-content min-h-[260px] px-[14px] py-3 sm:pl-[38px] text-base leading-relaxed focus-within:outline-none [&_p.is-empty]:before:content-[attr(data-placeholder)] [&_p.is-empty]:before:text-muted [&_p.is-empty]:before:float-left [&_p.is-empty]:before:h-0 [&_p.is-empty]:before:pointer-events-none"
      />
    </div>
  );
}
