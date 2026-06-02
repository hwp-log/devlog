import { MyPlanNewForm } from './MyPlanNewForm';
import { createMyPlanAction } from './actions';

export default function MyPlanNewPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">새 계획</h1>
      <MyPlanNewForm action={createMyPlanAction} />
    </div>
  );
}
