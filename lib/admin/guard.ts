import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export class AdminGuardError extends Error {
  constructor(public readonly reason: 'UNAUTHENTICATED' | 'FORBIDDEN') {
    super(reason);
  }
}

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AdminGuardError('UNAUTHENTICATED');

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (profile?.role !== 'ADMIN') throw new AdminGuardError('FORBIDDEN');

  return user;
}
