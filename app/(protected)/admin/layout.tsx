import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (profile?.role !== 'ADMIN') redirect('/');

  return <>{children}</>;
}
