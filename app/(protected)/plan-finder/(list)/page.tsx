import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fetchPublicPlans } from '@/lib/plan/queries';
import { PlanListClient } from '../_components/PlanListClient';
import { PlanFinderHeader } from '../_components/PlanFinderHeader';

export default async function PlanFinderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const plans = await fetchPublicPlans(user?.id);

  return (
    <div>
      {plans.length === 0 ? (
        <>
          <PlanFinderHeader />
          <div className="border-[1.5px] border-dashed border-border rounded-[14px] px-[22px] py-[56px] flex flex-col items-center text-center gap-4 mt-6">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <p className="text-[14px] leading-[1.6] text-fg2 break-keep">
              공개된 코스가 아직 없어요.
              <br />
              첫 코스의 점을 찍어보세요.
            </p>
            <Link
              href="/my-plan/new"
              className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
            >
              내 플랜 공개하기
            </Link>
          </div>
        </>
      ) : (
        <PlanListClient plans={plans} />
      )}
    </div>
  );
}
