/**
 * Demo Mode switch.
 *
 * Demo Mode swaps the Supabase client for an in-memory mock (demo/client.ts)
 * filled with fictional data (demo/data.ts). Nothing is read from or written
 * to the real backend while it is on, and no production credentials are
 * needed.
 *
 * It is only ever on when BOTH are true:
 *   1. the app runs in a development bundle (`__DEV__`) — release/production
 *      builds always get `false` here, regardless of environment variables;
 *   2. EXPO_PUBLIC_DEMO_MODE=1 was set when the dev server started
 *      (`npm run demo` does this).
 */
export const IS_DEMO: boolean = __DEV__ && process.env.EXPO_PUBLIC_DEMO_MODE === "1";

export const DEMO_USER_ID = "demo-user";
export const DEMO_EMAIL = "demo@loveback.invalid";
