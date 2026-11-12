// Translates raw Supabase/Postgres/network error messages into short,
// human, Swedish copy. Used everywhere an error currently gets shown to the
// user, instead of surfacing e.g. "duplicate key value violates unique
// constraint" or "Invalid login credentials" verbatim.

const KNOWN: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Fel e-post eller lösenord."],
  [/email not confirmed/i, "Bekräfta din e-post innan du loggar in."],
  [/user already registered/i, "Det finns redan ett konto med den e-postadressen."],
  [/password should be at least/i, "Lösenordet är för kort."],
  [/duplicate key value/i, "Det där finns redan."],
  [/network request failed|fetch failed|failed to fetch/i, "Ingen internetanslutning just nu."],
  [/jwt expired|invalid jwt|invalid refresh token/i, "Din session har gått ut — logga in igen."],
  [/rate limit/i, "För många försök — vänta lite och försök igen."],
  [/permission denied|not authorized|unauthorized/i, "Du har inte behörighet att göra det där."],
];

/**
 * Returns short, human, Swedish copy for a caught error. Pass a fallback for
 * anything unrecognized — never renders the raw error string to the user.
 */
export function friendlyError(error: unknown, fallback = "Något gick fel. Försök igen."): string {
  const raw = (error as any)?.message ?? (typeof error === "string" ? error : "");
  if (!raw) return fallback;
  for (const [pattern, message] of KNOWN) {
    if (pattern.test(raw)) return message;
  }
  return fallback;
}
