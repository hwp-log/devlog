'use client';
import { useActionState, useState } from 'react';
import { TiptapEditor } from './TiptapEditor';

type ActionState = { error: string } | null;

interface StoryWriteFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  initialData?: { title: string; content: string; tags: string[] };
  userId: string;
}

export function StoryWriteForm({ action, initialData, userId }: StoryWriteFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [content, setContent] = useState(initialData?.content ?? '');
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [tagInput, setTagInput] = useState('');

  function addTag() {
    const t = tagInput.trim();
    if (!t || tags.includes(t) || tags.length >= 5) return;
    setTags([...tags, t]);
    setTagInput('');
  }

  function removeTag(name: string) {
    setTags(tags.filter((t) => t !== name));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium text-[#1A1A1A]">제목</label>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={initialData?.title ?? ''}
          className="w-full border-[0.5px] border-black/15 rounded-[10px] px-[14px] py-3 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.08)] transition-all"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#1A1A1A]">본문</label>
        <TiptapEditor
          content={content}
          onChange={setContent}
          userId={userId}
          placeholder="다녀온 그 장소의 이야기를 남겨주세요..."
        />
        <input type="hidden" name="content" value={content} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#1A1A1A]">태그 <span className="text-slate-400 font-normal">({tags.length}/5)</span></label>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder="태그 입력 후 Enter"
            className="flex-1 border-[0.5px] border-black/15 rounded-[10px] px-[14px] py-2.5 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-black/40 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.08)] transition-all"
          />
          <button
            type="button"
            onClick={addTag}
            className="px-4 py-2.5 rounded-[10px] text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            추가
          </button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                #{tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-slate-400 hover:text-slate-700 transition-colors leading-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input type="hidden" name="tags" value={JSON.stringify(tags)} />
      </div>
      {state && 'error' in state && (
        <p role="alert" className="text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full mt-1 bg-[#1A1A1A] text-white rounded-full py-[13px] text-sm font-semibold hover:bg-[#333] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {initialData
          ? (isPending ? '수정 중...' : '수정')
          : (isPending ? '등록 중...' : '스토리 등록')}
      </button>
    </form>
  );
}
