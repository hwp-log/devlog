'use client';
import { useTransition } from 'react';
import Link from 'next/link';
import { PencilLine, Trash2 } from 'lucide-react';
import { StoryCard, type StoryCardProps } from '@/app/(protected)/story/_components/StoryCard';
import {
  CardOverflowMenu,
  MENU_ITEM_CLASS,
  MENU_DANGER_CLASS,
} from '@/app/(protected)/_components/CardOverflowMenu';
import { deleteStoryAction } from '@/app/(protected)/story/[id]/actions';

/**
 * 0547: 소유자 스토리 카드 — StoryCard(ownerView) + ⋯ 메뉴(편집·삭제), MyPlanCard 방식 이식.
 * StoryCard는 루트가 <Link>라 메뉴를 안에 넣으면 중첩 인터랙티브 → 래퍼의 형제 오버레이(z)로 분리
 * (MyPlanCard와 동일 원리). `group relative`는 셸의 호버 노출·absolute 앵커 전제.
 * 공개/비공개 전환·상태 배지는 없음 — Story 모델에 isPublic 개념 자체가 없다(전부 공개).
 * 삭제 confirm 문구·액션은 스토리 상세(DeleteButton)와 동일, 목적지만 /my-story.
 */
export function MyStoryCard(props: StoryCardProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="group relative">
      <StoryCard {...props} ownerView />
      {/* 위치 right-2 top-2 = StoryCard 칩 인셋(inset-x-2 top-2)과 정렬 */}
      <CardOverflowMenu title={props.title} positionClass="right-2 top-2">
        {(close) => (
          <>
            <Link href={`/story/${props.id}/edit`} role="menuitem" className={MENU_ITEM_CLASS}>
              <PencilLine size={15} className="opacity-75" />
              편집
            </Link>

            <div className="my-1 mx-1.5 h-px bg-hairline" />

            <button
              type="button"
              role="menuitem"
              disabled={isPending}
              onClick={() => {
                if (!confirm('정말 삭제하시겠습니까?')) return;
                close();
                startTransition(() => deleteStoryAction(props.id, '/my-story'));
              }}
              className={MENU_DANGER_CLASS}
            >
              <Trash2 size={15} className="opacity-75" />
              삭제
            </button>
          </>
        )}
      </CardOverflowMenu>
    </div>
  );
}
