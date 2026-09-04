import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appUrl, hasSupabaseConfig } from "@/lib/env";
export async function GET(request: NextRequest) {
  if (!hasSupabaseConfig()) return NextResponse.redirect(new URL("/login", request.url));
  const code = request.nextUrl.searchParams.get("code");
  if (code && code.length < 2048) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/reset-password", appUrl()));
  }
  return NextResponse.redirect(new URL("/login?error=reset", appUrl()));
}
