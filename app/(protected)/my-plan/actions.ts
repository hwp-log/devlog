'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export async function deleteMyPlanAction(planId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await prisma.myPlan.deleteMany({
    where: { id: planId, ownerId: user.id },
  });

  redirect('/my-plan');
}
