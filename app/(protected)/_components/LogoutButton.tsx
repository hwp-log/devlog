'use client';

interface LogoutButtonProps {
  action: (formData: FormData) => Promise<void>;
}

export function LogoutButton({ action }: LogoutButtonProps) {
  return (
    <form action={action}>
      <button type="submit" className="text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-md px-3 py-1 transition-colors">로그아웃</button>
    </form>
  );
}
