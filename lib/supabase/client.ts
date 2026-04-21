import { createBrowserClient } from '@supabase/ssr'

// Client Component용: 브라우저 쿠키를 자동으로 읽고 써서 세션 유지
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
