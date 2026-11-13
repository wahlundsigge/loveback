import { DEMO_EMAIL, DEMO_USER_ID } from "./config";
import { AUTO_REPLIES, DUO_OPENER, GENERIC_REPLIES, OPENERS, createSeed, type Row, type Tables } from "./data";

/**
 * In-memory stand-in for the Supabase client, used only in Demo Mode
 * (see demo/config.ts). It implements the slice of the supabase-js surface
 * this app actually calls — query builder, auth, realtime channels, RPCs,
 * storage — on top of plain arrays seeded from demo/data.ts.
 *
 * Nothing in this file talks to the network. All state lives in memory:
 * reloading the app (or calling resetDemo) restores the start state.
 */

const UNLOCK_COST = 80;
const ROSE_COST = 300;
const ROSE_REWARD = 150;
const BOOST_COST = 200;
const DUO_SLOT_COST = 100;
const LATENCY_MS = 90;

type DemoError = { message: string; code?: string };
type Result<T = any> = { data: T; error: DemoError | null };
type AuthListener = (event: string, session: any) => void;
type ChannelHandler = { cfg: { event: string; table: string; filter?: string }; cb: (payload: any) => void };
type Channel = { name: string; handlers: ChannelHandler[] };

let db: Tables = createSeed();
let session: { access_token: string; user: { id: string; email: string } } | null = null;
let idCounter = 0;
let timers: ReturnType<typeof setTimeout>[] = [];
const replyCursor: Record<string, number> = {};
const authListeners = new Set<AuthListener>();
const channels = new Set<Channel>();

const UNIQUE: Record<string, string[]> = {
  likes: ["from_user", "to_user"],
  matches: ["user1", "user2"],
  duo_likes: ["from_duo", "to_duo"],
};

// Embedded-join foreign keys used by the app's select strings.
const FK_COLUMN: Record<string, string> = {
  duos_member1_fkey: "member1",
  duos_member2_fkey: "member2",
};

const wait = (ms = LATENCY_MS) => new Promise<void>((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();
const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const table = (name: string): Row[] => (db[name] ??= []);
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)); };
const uid = () => session?.user.id ?? null;
const profileOf = (id: string | null | undefined) => table("profiles").find((p) => p.id === id);

/* ── Realtime ─────────────────────────────────────────────────────────── */

function emit(event: "INSERT" | "UPDATE" | "DELETE", tableName: string, newRow: Row, oldRow: Row = {}) {
  for (const ch of channels) {
    for (const h of ch.handlers) {
      if (h.cfg.table !== tableName) continue;
      if (h.cfg.event !== "*" && h.cfg.event !== event) continue;
      if (h.cfg.filter) {
        const [col, rest] = h.cfg.filter.split("=eq.");
        if (String((event === "DELETE" ? oldRow : newRow)[col]) !== rest) continue;
      }
      const payload = { eventType: event, schema: "public", table: tableName, new: clone(newRow), old: clone(oldRow) };
      setTimeout(() => { if (channels.has(ch)) h.cb(payload); }, 0);
    }
  }
}

/* ── Low-level writes (shared by the query builder and the RPCs) ──────── */

function insertRow(tableName: string, input: Row): Result<Row | null> {
  const rows = table(tableName);
  const unique = UNIQUE[tableName];
  if (unique && rows.some((r) => unique.every((c) => r[c] === input[c]))) {
    return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
  }
  const row: Row = { id: `demo-${tableName}-${++idCounter}`, created_at: nowIso(), ...input };
  rows.push(row);
  emit("INSERT", tableName, row);
  return { data: row, error: null };
}

function updateRow(tableName: string, row: Row, patch: Row) {
  const old = { ...row };
  Object.assign(row, patch);
  emit("UPDATE", tableName, row, old);
}

function grantCoins(userId: string, amount: number, type: string, description: string, refId: string | null = null) {
  const profile = profileOf(userId);
  if (!profile) return 0;
  const balance = (profile.coin_balance ?? 0) + amount;
  updateRow("profiles", profile, { coin_balance: balance });
  insertRow("coin_transactions", {
    user_id: userId, amount, balance_after: balance, type,
    ref_id: refId, ref_type: null, description, metadata: { demo: true },
  });
  return balance;
}

/* ── Scripted partners: keep the demo conversations alive ─────────────── */

function partnerOfMatch(match: Row): string {
  return match.user1 === DEMO_USER_ID ? match.user2 : match.user1;
}

/** The duo in a duo match that the given user is NOT a member of. */
function otherDuoOf(duoMatch: Row, userId: string) {
  return table("duos").find((d) => (d.id === duoMatch.duo_a || d.id === duoMatch.duo_b) && d.member1 !== userId && d.member2 !== userId);
}

function partnerSays(matchId: string, text: string, delayMs: number) {
  later(() => {
    const match = table("matches").find((m) => m.id === matchId);
    if (!match) return;
    const partner = profileOf(partnerOfMatch(match));
    if (!partner) return;
    insertRow("messages", { match_id: matchId, sender: partner.id, sender_name: partner.name, text });
  }, delayMs);
}

function afterDemoUserMessage(tableName: string, row: Row) {
  if (row.sender !== DEMO_USER_ID) return;
  if (tableName === "messages") {
    const match = table("matches").find((m) => m.id === row.match_id);
    if (!match) return;
    const partnerId = partnerOfMatch(match);
    const script = AUTO_REPLIES[partnerId] ?? GENERIC_REPLIES;
    const n = replyCursor[match.id] ?? 0;
    replyCursor[match.id] = n + 1;
    const text = n < script.length ? script[n] : GENERIC_REPLIES[n % GENERIC_REPLIES.length];
    partnerSays(match.id, text, 1900 + Math.min(text.length * 18, 1400));
  } else if (tableName === "duo_messages") {
    const dm = table("duo_matches").find((m) => m.id === row.duo_match_id);
    if (!dm) return;
    const speaker = profileOf(otherDuoOf(dm, DEMO_USER_ID)?.member1);
    if (!speaker) return;
    const n = replyCursor[dm.id] ?? 0;
    replyCursor[dm.id] = n + 1;
    const text = GENERIC_REPLIES[n % GENERIC_REPLIES.length];
    later(() => {
      insertRow("duo_messages", { duo_match_id: dm.id, sender: speaker.id, sender_name: speaker.name, text });
    }, 2200);
  }
}

/* ── Select-string projection (columns + embedded profile joins) ──────── */

function splitTopLevel(cols: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of cols) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function project(row: Row, cols: string): Row {
  const parts = splitTopLevel(cols.replace(/\s+/g, " ").trim());
  if (parts.length === 0 || parts.includes("*")) return clone(row);
  const out: Row = {};
  for (const part of parts) {
    const embed = part.match(/^(\w+):(\w+)!(\w+)\((.*)\)$/);
    if (embed) {
      const [, alias, target, fk, inner] = embed;
      const ref = table(target).find((r) => r.id === row[FK_COLUMN[fk] ?? fk]);
      out[alias] = ref ? project(ref, inner) : null;
    } else {
      out[part] = clone(row[part] ?? null);
    }
  }
  return out;
}

/* ── Query builder ────────────────────────────────────────────────────── */

type Op = "select" | "insert" | "update" | "upsert" | "delete";

class DemoQuery implements PromiseLike<Result> {
  private op: Op = "select";
  private columns = "*";
  private returning = false;
  private payload: Row | Row[] | null = null;
  private filters: ((r: Row) => boolean)[] = [];
  private orders: { col: string; ascending: boolean; nullsFirst: boolean }[] = [];
  private window: { from: number; to: number } | null = null;
  private mode: "many" | "single" | "maybe" = "many";

  constructor(private tableName: string) {}

  select(columns = "*") {
    this.columns = columns;
    if (this.op !== "select") this.returning = true;
    return this;
  }
  insert(payload: Row | Row[]) { this.op = "insert"; this.payload = payload; return this; }
  update(payload: Row) { this.op = "update"; this.payload = payload; return this; }
  upsert(payload: Row | Row[]) { this.op = "upsert"; this.payload = payload; return this; }
  delete() { this.op = "delete"; return this; }

  eq(col: string, value: any) { this.filters.push((r) => r[col] === value); return this; }
  neq(col: string, value: any) { this.filters.push((r) => r[col] !== value); return this; }
  in(col: string, values: any[]) { this.filters.push((r) => values.includes(r[col])); return this; }
  not(col: string, operator: string, value: string) {
    if (operator === "in") {
      const list = value.replace(/^\(|\)$/g, "").split(",").map((s) => s.trim());
      this.filters.push((r) => !list.includes(String(r[col])));
    }
    return this;
  }
  /** Supports the `col.eq.value,col.eq.value` form the app uses. */
  or(expr: string) {
    const clauses = expr.split(",").map((c) => {
      const [col, , ...rest] = c.trim().split(".");
      return { col, value: rest.join(".") };
    });
    this.filters.push((r) => clauses.some((c) => String(r[c.col]) === c.value));
    return this;
  }
  order(col: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    const ascending = opts.ascending ?? true;
    this.orders.push({ col, ascending, nullsFirst: opts.nullsFirst ?? !ascending });
    return this;
  }
  range(from: number, to: number) { this.window = { from, to }; return this; }
  limit(n: number) { this.window = { from: 0, to: n - 1 }; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  then<A = Result, B = never>(
    onFulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: any) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return wait().then(() => this.run()).then(onFulfilled, onRejected);
  }

  private matching(): Row[] {
    return table(this.tableName).filter((r) => this.filters.every((f) => f(r)));
  }

  private finish(rows: Row[]): Result {
    const data = rows.map((r) => project(r, this.columns));
    if (this.mode === "many") return { data, error: null };
    if (data.length === 0) {
      return this.mode === "maybe"
        ? { data: null, error: null }
        : { data: null, error: { code: "PGRST116", message: "No rows found" } };
    }
    return { data: data[0], error: null };
  }

  private run(): Result {
    switch (this.op) {
      case "select": {
        let rows = this.matching();
        for (const o of [...this.orders].reverse()) {
          rows = [...rows].sort((a, b) => {
            const av = a[o.col], bv = b[o.col];
            if (av == null && bv == null) return 0;
            if (av == null) return o.nullsFirst ? -1 : 1;
            if (bv == null) return o.nullsFirst ? 1 : -1;
            return (av < bv ? -1 : av > bv ? 1 : 0) * (o.ascending ? 1 : -1);
          });
        }
        if (this.window) rows = rows.slice(this.window.from, this.window.to + 1);
        return this.finish(rows);
      }
      case "insert": {
        const inputs = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
        const inserted: Row[] = [];
        for (const input of inputs) {
          const res = insertRow(this.tableName, clone(input));
          if (res.error || !res.data) return { data: null, error: res.error };
          inserted.push(res.data);
          afterDemoUserMessage(this.tableName, res.data);
        }
        return this.returning ? this.finish(inserted) : { data: null, error: null };
      }
      case "update": {
        const rows = this.matching();
        for (const row of rows) updateRow(this.tableName, row, clone(this.payload as Row));
        return this.returning ? this.finish(rows) : { data: null, error: null };
      }
      case "upsert": {
        const inputs = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
        const out: Row[] = [];
        for (const input of inputs) {
          const existing = table(this.tableName).find((r) => r.id === input.id);
          if (existing) { updateRow(this.tableName, existing, clone(input)); out.push(existing); }
          else {
            const res = insertRow(this.tableName, clone(input));
            if (res.error || !res.data) return { data: null, error: res.error };
            out.push(res.data);
          }
        }
        return this.returning ? this.finish(out) : { data: null, error: null };
      }
      case "delete": {
        const rows = this.matching();
        db[this.tableName] = table(this.tableName).filter((r) => !rows.includes(r));
        for (const row of rows) emit("DELETE", this.tableName, {}, row);
        return this.returning ? this.finish(rows) : { data: null, error: null };
      }
    }
  }
}

/* ── RPCs (mirror the SQL functions in supabase/migrations) ───────────── */

function activeDuoCount(userId: string) {
  return table("duos").filter((d) => (d.member1 === userId || d.member2 === userId) && d.status !== "left").length;
}

const RPC: Record<string, (args: Row, me: string) => Row> = {
  send_rose_atomic({ p_to_user, p_message }, me) {
    const sender = profileOf(me)!;
    const existing = table("matches").find((m) => m.super_liked_by === me && (m.user1 === p_to_user || m.user2 === p_to_user));
    if (existing) return { success: true, match_id: existing.id, error_code: "ALREADY_SENT" };
    if ((sender.coin_balance ?? 0) < ROSE_COST) return { success: false, match_id: null, error_code: "INSUFFICIENT_BALANCE" };
    if (!profileOf(p_to_user)) return { success: false, match_id: null, error_code: "RECIPIENT_NOT_FOUND" };

    insertRow("likes", { from_user: me, to_user: p_to_user, type: "super_like" });
    const [user1, user2] = [me, p_to_user].sort();
    const rose = {
      chat_unlocked: true, match_locked: false, paid_by: me,
      super_liked_by: me, super_liked_at: nowIso(), pending_reward: ROSE_REWARD, reward_paid: false,
    };
    let match = table("matches").find((m) => m.user1 === user1 && m.user2 === user2);
    if (match) updateRow("matches", match, rose);
    else match = insertRow("matches", { user1, user2, ...rose }).data!;
    insertRow("messages", { match_id: match.id, sender: me, sender_name: sender.name, text: String(p_message ?? "").trim() });
    grantCoins(me, -ROSE_COST, "super_like", "Rose skickad", match.id);
    return { success: true, match_id: match.id, error_code: null };
  },

  pay_rose_reward({ p_match_id }, me) {
    const match = table("matches").find((m) => m.id === p_match_id);
    if (!match) return { success: false, coins_earned: 0, error_code: "MATCH_NOT_FOUND" };
    if (match.reward_paid || !match.pending_reward) return { success: false, coins_earned: 0, error_code: "NO_PENDING_REWARD" };
    if (match.super_liked_by === me) return { success: false, coins_earned: 0, error_code: "SENDER_CANNOT_CLAIM" };
    updateRow("matches", match, { reward_paid: true });
    grantCoins(me, match.pending_reward, "super_like_reward", "Belöning: du svarade på en Rose", match.id);
    return { success: true, coins_earned: match.pending_reward, error_code: null };
  },

  activate_boost_atomic(_args, me) {
    const profile = profileOf(me)!;
    if ((profile.coin_balance ?? 0) < BOOST_COST) return { success: false, expires_at: null, error_code: "INSUFFICIENT_BALANCE" };
    const expires_at = new Date(Date.now() + 30 * 60_000).toISOString();
    updateRow("profiles", profile, { boost_expires_at: expires_at });
    grantCoins(me, -BOOST_COST, "boost", "Boost aktiverad");
    return { success: true, expires_at, error_code: null };
  },

  block_user({ p_blocked_id }, me) {
    if (!table("user_blocks").some((b) => b.blocker_id === me && b.blocked_id === p_blocked_id)) {
      insertRow("user_blocks", { blocker_id: me, blocked_id: p_blocked_id });
    }
    return { success: true, refunded: false, error_code: null };
  },

  report_user({ p_reported_id, p_reason }, me) {
    insertRow("user_reports", { reporter_id: me, reported_id: p_reported_id, reason: p_reason });
    return { success: true, error_code: null };
  },

  create_duo_invite(_args, me) {
    if (activeDuoCount(me) >= (profileOf(me)?.duo_slots ?? 1)) return { success: false, duo_id: null, invite_code: null, error_code: "TOO_MANY_DUOS" };
    const invite_code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const duo = insertRow("duos", { invite_code, status: "pending", member1: me, member2: null }).data!;
    return { success: true, duo_id: duo.id, invite_code, error_code: null };
  },

  join_duo({ p_code }, me) {
    const duo = table("duos").find((d) => d.invite_code === String(p_code ?? "").trim().toUpperCase());
    if (!duo) return { success: false, error_code: "CODE_NOT_FOUND" };
    if (duo.member1 === me) return { success: false, error_code: "CANNOT_JOIN_OWN_INVITE" };
    if (duo.status !== "pending") return { success: false, error_code: "CODE_ALREADY_USED" };
    if (activeDuoCount(me) >= (profileOf(me)?.duo_slots ?? 1)) return { success: false, error_code: "TOO_MANY_DUOS" };
    updateRow("duos", duo, { member2: me, status: "active" });
    const profile = profileOf(me)!;
    if (!profile.active_duo_id) updateRow("profiles", profile, { active_duo_id: duo.id });
    return { success: true, duo_id: duo.id, partner_id: duo.member1, error_code: null };
  },

  leave_duo({ p_duo_id }, me) {
    const duo = table("duos").find((d) => d.id === p_duo_id && (d.member1 === me || d.member2 === me));
    if (!duo) return { success: false, error_code: "DUO_NOT_FOUND" };
    updateRow("duos", duo, { status: "left" });
    const profile = profileOf(me)!;
    if (profile.active_duo_id === duo.id) {
      const next = table("duos").find((d) => (d.member1 === me || d.member2 === me) && d.status === "active");
      updateRow("profiles", profile, { active_duo_id: next?.id ?? null });
    }
    return { success: true, error_code: null };
  },

  set_active_duo({ p_duo_id }, me) {
    const duo = table("duos").find((d) => d.id === p_duo_id && (d.member1 === me || d.member2 === me) && d.status === "active");
    if (!duo) return { success: false, error_code: "DUO_NOT_FOUND" };
    updateRow("profiles", profileOf(me)!, { active_duo_id: duo.id });
    return { success: true, error_code: null };
  },

  duo_swipe_like({ p_my_duo_id, p_target_duo_id }) {
    insertRow("duo_likes", { from_duo: p_my_duo_id, to_duo: p_target_duo_id });
    const reciprocal = table("duo_likes").some((l) => l.from_duo === p_target_duo_id && l.to_duo === p_my_duo_id);
    if (!reciprocal) return { success: true, matched: false, duo_match_id: null, error_code: null };
    const [duo_a, duo_b] = [p_my_duo_id, p_target_duo_id].sort();
    const existing = table("duo_matches").find((m) => m.duo_a === duo_a && m.duo_b === duo_b);
    const match = existing ?? insertRow("duo_matches", { duo_a, duo_b, chat_unlocked: false, match_locked: true, paid_by: null }).data!;
    return { success: true, matched: true, duo_match_id: match.id, error_code: null };
  },

  unlock_duo_match_atomic({ p_duo_match_id }, me) {
    const match = table("duo_matches").find((m) => m.id === p_duo_match_id);
    if (!match) return { success: false, payer_balance: 0, error_code: "MATCH_NOT_FOUND" };
    const balance = profileOf(me)?.coin_balance ?? 0;
    if (match.chat_unlocked) return { success: true, payer_balance: balance, error_code: null };
    if (balance < UNLOCK_COST) return { success: false, payer_balance: balance, error_code: "INSUFFICIENT_BALANCE" };
    updateRow("duo_matches", match, { chat_unlocked: true, match_locked: false, paid_by: me });
    const payer_balance = grantCoins(me, -UNLOCK_COST, "duo_unlock_match", "Låste upp Duo-match", match.id);
    const speaker = profileOf(otherDuoOf(match, me)?.member1);
    if (speaker) {
      later(() => {
        insertRow("duo_messages", { duo_match_id: match.id, sender: speaker.id, sender_name: speaker.name, text: DUO_OPENER });
      }, 2600);
    }
    return { success: true, payer_balance, error_code: null };
  },

  buy_duo_slot(_args, me) {
    const profile = profileOf(me)!;
    const slots = profile.duo_slots ?? 1;
    if ((profile.coin_balance ?? 0) < DUO_SLOT_COST) return { success: false, new_slots: slots, coin_balance: profile.coin_balance ?? 0, error_code: "INSUFFICIENT_BALANCE" };
    updateRow("profiles", profile, { duo_slots: slots + 1 });
    const coin_balance = grantCoins(me, -DUO_SLOT_COST, "duo_slot_purchase", "Extra Duo-plats");
    return { success: true, new_slots: slots + 1, coin_balance, error_code: null };
  },
};

/* ── Edge Functions (mirror supabase/functions) ───────────────────────── */

export async function demoEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  await wait(350);
  const me = uid();
  if (!me) throw new Error("Not authenticated");
  const profile = profileOf(me)!;

  if (name === "unlock-match") {
    const match = table("matches").find((m) => m.id === body.match_id);
    if (!match) return { success: false, payer_balance: profile.coin_balance, partner_balance: 0, error_code: "MATCH_NOT_FOUND" } as T;
    if (match.chat_unlocked) return { success: false, payer_balance: profile.coin_balance, partner_balance: 0, error_code: "ALREADY_UNLOCKED" } as T;
    if ((profile.coin_balance ?? 0) < UNLOCK_COST) return { success: false, payer_balance: profile.coin_balance, partner_balance: 0, error_code: "INSUFFICIENT_BALANCE" } as T;
    updateRow("matches", match, { chat_unlocked: true, match_locked: false, paid_by: me });
    const payer_balance = grantCoins(me, -UNLOCK_COST, "unlock_match", "Låste upp match", match.id);
    const partnerId = partnerOfMatch(match);
    partnerSays(match.id, OPENERS[partnerId] ?? "Hej! Kul att vi matchade 😊", 2600);
    return { success: true, payer_balance, partner_balance: 0 } as T;
  }

  if (name === "purchase-coins") {
    const pkg = table("coin_packages").find((p) => p.id === body.package_id && p.is_active);
    if (!pkg) throw new Error("Paketet hittades inte.");
    const coins_added = pkg.coins + pkg.bonus_coins;
    const new_balance = grantCoins(me, coins_added, "purchase", `Demoköp: ${pkg.label} (ingen betalning)`);
    return {
      success: true, new_balance, coins_added,
      package: { id: pkg.id, label: pkg.label, coins: pkg.coins, bonus_coins: pkg.bonus_coins, price_sek: pkg.price_sek },
    } as T;
  }

  if (name === "get-wallet") {
    const transactions = table("coin_transactions")
      .filter((t) => t.user_id === me)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return {
      coin_balance: profile.coin_balance ?? 0,
      transactions: clone(transactions),
      purchase_history: clone(transactions.filter((t) => t.type === "purchase")),
      reward_history: clone(transactions.filter((t) => t.amount > 0 && t.type !== "purchase")),
    } as T;
  }

  throw new Error(`Okänd demo-funktion: ${name}`);
}

/* ── Session helpers ──────────────────────────────────────────────────── */

function notifyAuth(event: string) {
  for (const listener of [...authListeners]) listener(event, session);
}

function signIn() {
  session = { access_token: "demo-session", user: { id: DEMO_USER_ID, email: DEMO_EMAIL } };
  notifyAuth("SIGNED_IN");
  return { data: { session, user: session.user }, error: null };
}

/** Restores every table to the start state. The demo session stays signed in. */
export function resetDemo() {
  for (const t of timers) clearTimeout(t);
  timers = [];
  for (const key of Object.keys(replyCursor)) delete replyCursor[key];
  const oldBalance = profileOf(DEMO_USER_ID)?.coin_balance ?? 0;
  db = createSeed();
  idCounter = 0;
  // Let live subscribers (coin balance chip) pick up the restored balance —
  // reported as "no gain" so it doesn't trigger a coin toast.
  const me = profileOf(DEMO_USER_ID);
  if (me) emit("UPDATE", "profiles", me, { ...me, coin_balance: Math.max(oldBalance, me.coin_balance) });
}

/* ── The client ───────────────────────────────────────────────────────── */

export function createDemoClient() {
  return {
    from: (tableName: string) => new DemoQuery(tableName),

    async rpc(name: string, args: Row = {}): Promise<Result> {
      await wait(220);
      const me = uid();
      if (!me) return { data: null, error: { message: "NOT_AUTHENTICATED" } };
      const fn = RPC[name];
      if (!fn) return { data: null, error: { message: `Demo Mode saknar RPC: ${name}` } };
      return { data: [fn(args, me)], error: null };
    },

    auth: {
      async getSession() { return { data: { session }, error: null }; },
      async getUser() { return { data: { user: session?.user ?? null }, error: null }; },
      async signInWithPassword(_credentials?: unknown) { await wait(250); return signIn(); },
      async signUp(_credentials?: unknown) { await wait(250); return signIn(); },
      async signOut() {
        session = null;
        notifyAuth("SIGNED_OUT");
        return { error: null };
      },
      onAuthStateChange(listener: AuthListener) {
        authListeners.add(listener);
        setTimeout(() => { if (authListeners.has(listener)) listener("INITIAL_SESSION", session); }, 0);
        return { data: { subscription: { unsubscribe: () => { authListeners.delete(listener); } } } };
      },
    },

    channel(name: string) {
      const ch: Channel & Record<string, any> = {
        name,
        handlers: [],
        on(_type: string, cfg: ChannelHandler["cfg"], cb: ChannelHandler["cb"]) { ch.handlers.push({ cfg, cb }); return ch; },
        subscribe(cb?: (status: string) => void) { channels.add(ch); cb?.("SUBSCRIBED"); return ch; },
        unsubscribe() { channels.delete(ch); return Promise.resolve("ok"); },
      };
      return ch;
    },
    removeChannel(ch: Channel) { channels.delete(ch); return Promise.resolve("ok"); },

    storage: {
      from: (_bucket: string) => ({
        async upload(path: string) { return { data: { path }, error: null }; },
        getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
      }),
    },
  };
}
