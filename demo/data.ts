import { LIFE, PEOPLE } from "./assets";
import { DEMO_EMAIL, DEMO_USER_ID } from "./config";

/**
 * Fictional seed data for Demo Mode. Every person, message and transaction
 * here is invented — none of it exists in (or is copied from) the real
 * backend. createSeed() returns a fresh copy each call so "Återställ demo"
 * can restore the exact start state.
 */

export type Row = Record<string, any>;
export type Tables = Record<string, Row[]>;

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const HOUR = 60;
const DAY = 24 * HOUR;

type Person = {
  key: keyof typeof PEOPLE;
  name: string;
  age: number;
  gender: "kvinna" | "man";
  distance: number;
  life?: keyof typeof LIFE;
  goals?: string[];
};

// Solo deck, in the order the cards appear (first = top of the deck).
// Saga (3rd) and Ines (6th) have already liked the demo user, so swiping
// right on them produces a match.
const DECK: Person[] = [
  { key: "elsa", name: "Elsa", age: 26, gender: "kvinna", distance: 3, life: "coffee", goals: ["Seriöst förhållande"] },
  { key: "maja", name: "Maja", age: 24, gender: "kvinna", distance: 7, life: "mountains", goals: ["Öppen", "Vänner"] },
  { key: "saga", name: "Saga", age: 27, gender: "kvinna", distance: 2, life: "lake", goals: ["Seriöst förhållande"] },
  { key: "nora", name: "Nora", age: 25, gender: "kvinna", distance: 12, life: "food", goals: ["Casual", "Öppen"] },
  { key: "alva", name: "Alva", age: 29, gender: "kvinna", distance: 5, life: "paint", goals: ["Seriöst förhållande"] },
  { key: "ines", name: "Ines", age: 26, gender: "kvinna", distance: 4, life: "concert", goals: ["Öppen"] },
  { key: "liv", name: "Liv", age: 23, gender: "kvinna", distance: 9, life: "dog", goals: ["Vänner", "Casual"] },
  { key: "freja", name: "Freja", age: 28, gender: "kvinna", distance: 6, life: "music", goals: ["Seriöst förhållande", "Öppen"] },
];

// People the demo user has already matched with (never shown in the deck).
const MATCHED: Person[] = [
  { key: "wilma", name: "Wilma", age: 27, gender: "kvinna", distance: 4, life: "forest" },
  { key: "klara", name: "Klara", age: 26, gender: "kvinna", distance: 8, life: "beach" },
  { key: "ebba", name: "Ebba", age: 24, gender: "kvinna", distance: 3 },
  { key: "linnea", name: "Linnea", age: 29, gender: "kvinna", distance: 11, life: "boat" },
];

// Friends that only appear as Duo members.
const DUO_PEOPLE: Person[] = [
  { key: "hugo", name: "Hugo", age: 27, gender: "man", distance: 2 },
  { key: "tuva", name: "Tuva", age: 25, gender: "kvinna", distance: 5 },
  { key: "stella", name: "Stella", age: 26, gender: "kvinna", distance: 5 },
  { key: "leo", name: "Leo", age: 28, gender: "man", distance: 9 },
  { key: "noah", name: "Noah", age: 26, gender: "man", distance: 9 },
  { key: "adam", name: "Adam", age: 30, gender: "man", distance: 14 },
  { key: "elias", name: "Elias", age: 25, gender: "man", distance: 14 },
  { key: "theo", name: "Theo", age: 29, gender: "man", distance: 6 },
];

export const pid = (key: string) => `p-${key}`;

function profileRow(p: Person, createdMinutesAgo: number): Row {
  const images = p.life ? [PEOPLE[p.key], LIFE[p.life]] : [PEOPLE[p.key]];
  return {
    id: pid(p.key),
    email: `${p.key}@loveback.invalid`,
    first_name: p.name,
    last_name: "",
    name: p.name,
    age: p.age,
    gender: p.gender,
    looking_for: "alla",
    distance: p.distance,
    avatar: images[0],
    images,
    dating_goals: p.goals ?? [],
    profile_completed: true,
    coin_balance: 0,
    boost_expires_at: null,
    created_at: minutesAgo(createdMinutesAgo),
    min_age: 18,
    max_age: 45,
    phone: null,
    is_admin: false,
    active_duo_id: null,
    duo_slots: 1,
  };
}

/** Replies the fictional partner sends back while the presenter chats. */
export const AUTO_REPLIES: Record<string, string[]> = {
  [pid("saga")]: [
    "Haha, bra öppning! Jag är svag för folk som faktiskt skriver först 😄",
    "Torsdag funkar fint. Jag känner till ett ställe vid vattnet – litar du på mig?",
    "Perfekt. Då ses vi där 🥂",
  ],
  [pid("ines")]: [
    "Äntligen någon med musiksmak! Vilken var din senaste konsert?",
    "Okej, det där låter som en plan. Jag tar med hörlurar, du tar med kaffe ☕",
  ],
  [pid("ebba")]: [
    "Hej! Kul att du låste upp 😊 Vad gör du helst en ledig lördag?",
    "Det låter precis som min typ av lördag.",
  ],
  [pid("wilma")]: [
    "Onsdag efter jobbet? Jag bjuder på första koppen ☕",
    "Bra! Jag skickar adressen sen 🏔️",
  ],
  [pid("klara")]: [
    "Söndag klockan tio då. Glöm inte badkläder!",
    "Haha, jag ser fram emot det 😄",
  ],
  [pid("linnea")]: [
    "Vad glad jag blir att du svarade! Fredag klockan sju?",
    "Då säger vi så. Jag väljer vinet 🍷",
  ],
};

export const GENERIC_REPLIES = [
  "Haha, det låter bra 😊",
  "Berätta mer!",
  "Precis vad jag tänkte.",
  "Det där vill jag höra mer om över en kaffe ☕",
];

/** First message a new match sends once the chat has been unlocked. */
export const OPENERS: Record<string, string> = {
  [pid("saga")]: "Hej Alex! Jag hoppades att du skulle svepa höger 😊",
  [pid("ines")]: "Hej! Din profil fick mig att le – vad lyssnar du på just nu? 🎧",
  [pid("ebba")]: "Hej! Kul att vi matchade 😊",
};

export const DUO_OPENER = "Hej killar! Dubbeldejt i helgen? 🥂";

export function createSeed(): Tables {
  const me: Row = {
    id: DEMO_USER_ID,
    email: DEMO_EMAIL,
    first_name: "Alex",
    last_name: "",
    name: "Alex",
    age: 28,
    gender: "man",
    looking_for: "kvinna",
    distance: 30,
    avatar: PEOPLE.alex,
    images: [PEOPLE.alex, LIFE.hiking, LIFE.coffee],
    dating_goals: ["Seriöst förhållande"],
    profile_completed: true,
    coin_balance: 1240,
    boost_expires_at: null,
    created_at: minutesAgo(30 * DAY),
    min_age: 22,
    max_age: 35,
    phone: null,
    is_admin: false,
    active_duo_id: "d-mine",
    duo_slots: 2,
  };

  const profiles: Row[] = [
    me,
    // Newest first = top of the deck (the deck orders by created_at desc).
    ...DECK.map((p, i) => profileRow(p, 60 + i * 30)),
    ...MATCHED.map((p, i) => profileRow(p, 5 * DAY + i * 60)),
    ...DUO_PEOPLE.map((p, i) => profileRow(p, 8 * DAY + i * 60)),
  ];

  const likes: Row[] = [
    // They already like the demo user → a right-swipe on them is a match.
    { id: "l-1", from_user: pid("saga"), to_user: DEMO_USER_ID, created_at: minutesAgo(3 * HOUR) },
    { id: "l-2", from_user: pid("ines"), to_user: DEMO_USER_ID, created_at: minutesAgo(5 * HOUR) },
    // Existing matches — liked earlier, so they stay out of the deck.
    ...MATCHED.map((p, i) => ({ id: `l-m${i}`, from_user: DEMO_USER_ID, to_user: pid(p.key), created_at: minutesAgo(4 * DAY) })),
    ...MATCHED.map((p, i) => ({ id: `l-r${i}`, from_user: pid(p.key), to_user: DEMO_USER_ID, created_at: minutesAgo(4 * DAY) })),
  ];

  const match = (id: string, partner: string, extra: Row, createdMinutesAgo: number): Row => ({
    id,
    user1: DEMO_USER_ID,
    user2: pid(partner),
    match_locked: true,
    chat_unlocked: false,
    paid_by: null,
    super_liked_by: null,
    super_liked_at: null,
    pending_reward: 0,
    reward_paid: false,
    created_at: minutesAgo(createdMinutesAgo),
    ...extra,
  });

  const matches: Row[] = [
    match("m-wilma", "wilma", { match_locked: false, chat_unlocked: true, paid_by: DEMO_USER_ID }, 3 * DAY),
    match("m-klara", "klara", { match_locked: false, chat_unlocked: true, paid_by: pid("klara") }, 2 * DAY),
    match("m-ebba", "ebba", {}, 6 * HOUR),
    match(
      "m-linnea",
      "linnea",
      { match_locked: false, chat_unlocked: true, paid_by: pid("linnea"), super_liked_by: pid("linnea"), super_liked_at: minutesAgo(50), pending_reward: 150 },
      50,
    ),
  ];

  let msgN = 0;
  const msg = (matchId: string, sender: string, senderName: string, text: string, sentMinutesAgo: number): Row => ({
    id: `msg-${++msgN}`,
    match_id: matchId,
    sender,
    sender_name: senderName,
    text,
    created_at: minutesAgo(sentMinutesAgo),
  });

  const messages: Row[] = [
    msg("m-wilma", DEMO_USER_ID, "Alex", "Hej Wilma! Såg att du också gillar att vandra – har du någon favoritled?", 2 * DAY + 5 * HOUR),
    msg("m-wilma", pid("wilma"), "Wilma", "Hej! Ja, Kungsleden förra sommaren var magisk 🏔️ Du då?", 2 * DAY + 4 * HOUR),
    msg("m-wilma", DEMO_USER_ID, "Alex", "Sörmlandsleden blir det oftast. Men Kungsleden står högt på listan.", 2 * DAY + 3 * HOUR),
    msg("m-wilma", pid("wilma"), "Wilma", "Då har du något att se fram emot! Ska vi ta en kaffe i veckan och planera rutten? ☕", 26 * HOUR),
    msg("m-klara", pid("klara"), "Klara", "Hej! Jag kunde inte låta bli att låsa upp – din vandringsbild avgjorde saken 😄", 9 * HOUR),
    msg("m-klara", DEMO_USER_ID, "Alex", "Haha, den brukar göra jobbet. Är du också ute mycket?", 8 * HOUR),
    msg("m-klara", pid("klara"), "Klara", "Varje helg! Söndag – Hellasgården och bastu efteråt?", 42),
    msg("m-linnea", pid("linnea"), "Linnea", "Du verkar vara precis den sortens person jag vill dela ett långt samtal och ett glas vin med. Fredag?", 50),
  ];

  const duo = (id: string, m1: string, m2: string | null, status: string, code: string, createdMinutesAgo: number): Row => ({
    id,
    invite_code: code,
    status,
    member1: m1,
    member2: m2,
    created_at: minutesAgo(createdMinutesAgo),
  });

  const duos: Row[] = [
    duo("d-mine", DEMO_USER_ID, pid("hugo"), "active", "HUGO27", 6 * DAY),
    duo("d-tuva-stella", pid("tuva"), pid("stella"), "active", "TUVA25", 1 * DAY),
    duo("d-leo-noah", pid("leo"), pid("noah"), "active", "LEON28", 2 * DAY),
    duo("d-adam-elias", pid("adam"), pid("elias"), "active", "ADAM30", 3 * DAY),
    // An open invite the presenter can join with the code DEMO26.
    duo("d-theo", pid("theo"), null, "pending", "DEMO26", 2 * HOUR),
  ];

  const duo_likes: Row[] = [
    // Tuva & Stella already like the demo duo → swiping right is a Duo match.
    { id: "dl-1", from_duo: "d-tuva-stella", to_duo: "d-mine", created_at: minutesAgo(4 * HOUR) },
  ];

  let balance = 0;
  let txN = 0;
  const tx = (amount: number, type: string, description: string, createdMinutesAgo: number): Row => {
    balance += amount;
    return {
      id: `tx-${++txN}`,
      user_id: DEMO_USER_ID,
      amount,
      balance_after: balance,
      type,
      ref_id: null,
      ref_type: null,
      description,
      created_at: minutesAgo(createdMinutesAgo),
      metadata: {},
    };
  };

  const coin_transactions: Row[] = [
    tx(1000, "purchase", "Köp: 1 000 Coins", 6 * DAY),
    tx(-200, "boost", "Boost aktiverad", 5 * DAY),
    tx(-80, "unlock_match", "Låste upp match", 3 * DAY),
    tx(20, "reward", "Belöning: din match låste upp chatten", 2 * DAY),
    tx(500, "purchase", "Köp: 500 Coins", 1 * DAY),
  ];

  const coin_packages: Row[] = [
    [80, 8, "80 Coins"],
    [300, 30, "300 Coins"],
    [500, 50, "500 Coins"],
    [1000, 100, "1 000 Coins"],
    [2500, 250, "2 500 Coins"],
    [5000, 500, "5 000 Coins"],
  ].map(([coins, price, label], i) => ({
    id: `pkg-${i + 1}`,
    coins,
    price_sek: price,
    label,
    bonus_coins: 0,
    sort_order: i + 1,
    is_active: true,
  }));

  return {
    profiles,
    likes,
    matches,
    messages,
    user_blocks: [],
    user_reports: [],
    duos,
    duo_likes,
    duo_matches: [],
    duo_messages: [],
    coin_transactions,
    coin_packages,
  };
}
