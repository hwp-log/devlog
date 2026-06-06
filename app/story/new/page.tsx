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
    <div className="max-w-7xl mx-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2">새 스토리 작성</h1>
        <p className="text-sm text-slate-500 mb-6">다녀온 그 장소, 당신의 이야기를 남겨주세요</p>
        <StoryWriteForm action={createStoryAction} userId={user.id} availablePlans={availablePlans} />
      </div>
    </div>
  );
}
