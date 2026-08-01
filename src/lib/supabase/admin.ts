import { env, hasSupabaseConfig } from "@/lib/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type UntypedDatabase = Record<string, never>;

let adminClient: SupabaseClient<UntypedDatabase> | null = null;

export function getSupabaseAdmin() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase no está configurado.");
  }

  if (!adminClient) {
    adminClient = createClient<UntypedDatabase>(
      env.SUPABASE_URL!,
      env.SUPABASE_SERVICE_ROLE_KEY!,
      {
      auth: {
        persistSession: false,
      },
      },
    );
  }

  return adminClient;
}
