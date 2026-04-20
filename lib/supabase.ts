import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Fail fast: 환경변수 누락 시 모듈 import 시점에 즉시 실패
if (!supabaseUrl) {
  throw new Error('환경변수 NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.')
}
if (!supabaseAnonKey) {
  throw new Error('환경변수 NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.')
}
// ES Module 캐싱으로 자동 싱글톤 (별도 패턴 불필요)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)