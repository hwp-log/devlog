'use client';

interface LogoutButtonProps {
  action: (formData: FormData) => Promise<void>;
}

export function LogoutButton({ action }: LogoutButtonProps) {
  return (
    <form action={action}>
      <button type="submit">로그아웃</button>
    </form>
  );
}
