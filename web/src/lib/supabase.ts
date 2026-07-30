import { createClient } from "@supabase/supabase-js";

/** 읽기 전용 anon 키 (RLS로 select만 허용) */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);
