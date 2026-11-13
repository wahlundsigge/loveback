/**
 * Lazy entry point to the demo implementation.
 *
 * The check is written inline (not via IS_DEMO) on purpose: in release builds
 * Metro replaces `__DEV__` with `false` and folds the expression before it
 * collects dependencies, so demo/client.ts, demo/data.ts and every photo in
 * assets/demo/ are left out of production bundles entirely.
 */
export const demoRuntime: typeof import("./client") | null =
  __DEV__ && process.env.EXPO_PUBLIC_DEMO_MODE === "1"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./client")
    : null;
