import { loginAction } from './actions';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-700">로그인</h2>
      </div>
      <LoginForm action={loginAction} />
    </div>
  );
}
