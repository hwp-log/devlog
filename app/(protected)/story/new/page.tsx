import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { StoryWriteForm } from './StoryWriteForm';
import { createStoryAction } from './actions';

export default async function StoryNewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const availablePlans = await prisma.myPlan.findMany({
    where: { ownerId: user.id, story: null },
    select: {
      id: true, title: true, currency: true,
      costs: { select: { category: true, amount: true } },
      flight: { select: { totalAmount: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-4xl mx-auto">
        {/* 헤더는 폼 블록과 같은 760 축 (좌측 정렬) — StoryWriteForm의 max-w-[760px]와 짝 */}
        <div className="max-w-[760px]">
          <p className="text-[12px] font-medium uppercase tracking-wider text-primary">WRITE</p>
          <h1 className="text-2xl font-bold text-fg mb-6 break-keep">다녀온 촬영지를 이야기로 남겨보세요</h1>
        </div>
        <StoryWriteForm action={createStoryAction} userId={user.id} availablePlans={availablePlans} />
    </div>
  );
}
