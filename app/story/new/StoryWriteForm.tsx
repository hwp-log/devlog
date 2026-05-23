'use client';
import { useActionState, useState } from 'react';
import { TiptapEditor } from './TiptapEditor';

type ActionState = { error: string } | null;

interface StoryWriteFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  initialData?: { title: string; content: string };
  userId: string;
}

export function StoryWriteForm({ action, initialData, userId }: StoryWriteFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [content, setContent] = useState(initialData?.content ?? '');

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
