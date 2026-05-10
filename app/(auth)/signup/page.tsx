import { signupAction } from './actions';
import { SignupForm } from './SignupForm';

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-700">회원가입</h2>
      </div>
      <SignupForm action={signupAction} />
    </div>
  );
}
