import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { DeleteButton } from './DeleteButton';
import SpotMap from '@/components/SpotMapWrapper';
import { MapPin } from 'lucide-react';
import { CostSection } from '@/app/(protected)/my-plan/_components/CostSection';
import { CATEGORIES, type CostCategory } from '@/app/(protected)/my-plan/_lib/cost';

export default async function StoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  const story = await prisma.story.findUnique({
    where: { id },
    include: {
      user: true,
      tags: true,
      spots: { orderBy: { order: 'asc' } },
      plan: {
        select: {
          currency: true,
          costs: { select: { category: true, amount: true } },
          flight: { select: { totalAmount: true } },
        },
      },
    },
  });
  if (!story) notFound();

  const isOwner = currentUser?.id === story.userId;

  const costTotals = story.plan
    ? (Object.fromEntries(
        CATEGORIES.map((cat) => [
          cat,
          story.plan!.costs
            .filter((c) => c.category === cat)
            .reduce((s, c) => s + c.amount, 0),
        ])
      ) as Record<CostCategory, number>)
    : null;
  const flightAmount = story.plan?.flight?.totalAmount ?? 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="max-w-4xl mx-auto">
      <div className="glass-outer p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-6">
            <h1 className="text-3xl font-bold text-[#1A1A1A] leading-tight">{story.title}</h1>
            {isOwner && (
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/story/${story.id}/edit`}
                  className="px-4 py-1.5 rounded-full text-sm bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors"
                >
                  수정
                </Link>
                <DeleteButton storyId={story.id} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
            <span>{story.user.email}</span>
            <span>·</span>
            <span>{story.createdAt.toLocaleDateString('ko-KR')}</span>
          </div>
          <div
            className="tiptap-content text-base text-slate-800 leading-relaxed mb-6"
            dangerouslySetInnerHTML={{ __html: story.content }}
          />
          {story.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-6">
              {story.tags.map((tag) => (
                <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  #{tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {story.spots.length > 0 && (
        <div className="mt-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#1A1A1A] mb-4">
            <MapPin size={16} />
            여행동선
          </h2>
          <SpotMap spots={story.spots} readOnly />
        </div>
      )}
      {story.plan && costTotals && (
        <div className="mt-6">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">예산 요약</h2>
          <CostSection
            totals={costTotals}
            flightAmount={flightAmount}
            currency={story.plan.currency as 'KRW' | 'USD' | 'JPY'}
          />
        </div>
      )}
      <div className="mt-4">
        <Link href="/story" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
          ← 목록으로
        </Link>
      </div>
      </div>
    </div>
  );
}
