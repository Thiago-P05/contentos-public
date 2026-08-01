import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

function getSupabaseAuthUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
}

function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function hasSupabaseBrowserAuthConfig() {
  return Boolean(getSupabaseAuthUrl() && getSupabaseAnonKey());
}

export function createSupabaseBrowserClient() {
  const url = getSupabaseAuthUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error("Supabase Auth no esta configurado para el cliente.");
  }

  if (browserClient) {
    return browserClient;
  }

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}