import { fetchPublicPlans } from '@/lib/plan/queries';
import { PlanCard } from './_components/PlanCard';

export default async function CostPlanPage() {
  const plans = await fetchPublicPlans();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">CostPlan</h1>
      {plans.length === 0 ? (
        <div className="glass-outer p-12 text-center text-slate-500">
          아직 공개된 플랜이 없습니다
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <PlanCard key={plan.id} {...plan} />
          ))}
        </div>
      )}
    </div>
  );
}
