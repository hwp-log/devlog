import 'server-only';
import { createClient } from '@supabase/supabase-js';

// service_role 전용 클라이언트. auth.admin API(회원 삭제 등)에서만 사용.
// 클라이언트 번들에 절대 포함되면 안 됨 — 'server-only' import로 강제.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 미설정');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
