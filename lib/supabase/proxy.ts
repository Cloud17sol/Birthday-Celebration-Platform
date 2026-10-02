import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

type RefreshedCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });
  const refreshedCookies: RefreshedCookie[] = [];

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          cookiesToSet.forEach((cookie) => {
            const existingIndex = refreshedCookies.findIndex(
              (existing) => existing.name === cookie.name
            );

            if (existingIndex === -1) {
              refreshedCookies.push(cookie);
            } else {
              refreshedCookies[existingIndex] = cookie;
            }
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          refreshedCookies.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}
