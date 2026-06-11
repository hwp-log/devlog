import { createClient } from '@/lib/supabase/server';
import { fetchPublicPlans } from '@/lib/plan/queries';
import { PlanListClient } from './_components/PlanListClient';

export default async function CostPlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const plans = await fetchPublicPlans(user?.id);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">CostPlan</h1>
      {plans.length === 0 ? (
        <div className="glass-outer p-12 text-center text-slate-500">
          아직 공개된 플랜이 없습니다
        </div>
      ) : (
        <PlanListClient plans={plans} />
      )}
    </div>
  );
}
