import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { demoRuntime } from "../../demo/runtime";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function createRealClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "LoveBack saknar EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Kopiera .env.example till .env och fyll i värdena, eller starta demoläget med `npm run demo`."
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
}

// Demo Mode (dev bundles only, see demo/config.ts) swaps in an in-memory
// client with fictional data — it never touches the real backend and needs
// no credentials. Everything else gets the real Supabase client.
export const supabase: SupabaseClient = demoRuntime
  ? (demoRuntime.createDemoClient() as unknown as SupabaseClient)
  : createRealClient();
