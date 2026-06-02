import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export default async function MyPlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const plans = await prisma.myPlan.findMany({
    where: { ownerId: user!.id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">My Plan</h1>
        <Link
          href="/my-plan/new"
          className="bg-[#1A1A1A] text-white px-5 py-2 rounded-full text-sm"
        >
          새 계획
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="glass-outer p-12 text-center">
          <p className="text-slate-500">아직 계획이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Link key={plan.id} href={`/my-plan/${plan.id}`} className="glass-outer p-6 block hover:shadow-md transition-shadow">
              <h2 className="text-lg font-semibold text-[#1A1A1A]">{plan.title}</h2>
              <p className="text-sm text-slate-500 mt-1">{plan.currency}</p>
              <p className="text-xs text-slate-400 mt-2">
                {plan.startDate && plan.endDate
                  ? `${plan.startDate.toLocaleDateString('ko-KR')} ~ ${plan.endDate.toLocaleDateString('ko-KR')}`
                  : '기간 미설정'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
