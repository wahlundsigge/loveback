# LoveBack

Premium dating-app byggd med Expo (React Native) och Supabase.

## Snabbstart – demoläge (ingen inloggning, inga nycklar)

```powershell
npm install
npm run demo
```

Skanna QR-koden med Expo Go på telefonen. Steg-för-steg-guide för en ny dator
finns i [MEETING_SETUP.md](MEETING_SETUP.md), och ett färdigt demomanus i
[MEETING_DEMO.md](MEETING_DEMO.md).

| Kommando | Vad det gör |
| --- | --- |
| `npm run demo` | Startar appen i demoläge (telefon via Expo Go, samma wifi) |
| `npm run demo:tunnel` | Samma, men via tunnel – när wifi-nätet blockerar anslutningen |
| `npm run demo:web` | Demoläge i webbläsaren på datorn |
| `npm start` | Vanligt läge mot riktig backend (kräver `.env`) |
| `npm run typecheck` | TypeScript-kontroll |
| `npm run lint` | ESLint |

## Demoläge

Demoläget byter ut Supabase-klienten mot en minnesbaserad kopia med fiktiv
data. Ingenting läses från eller skrivs till den riktiga databasen, och inga
nycklar behövs.

- `demo/config.ts` – strömbrytaren `IS_DEMO`. Kräver **både** utvecklingsbygge
  (`__DEV__`) och `EXPO_PUBLIC_DEMO_MODE=1`. Produktionsbyggen får alltid
  `false`.
- `demo/runtime.ts` – laddar demokoden bara i demoläge, så att kod, data och
  bilder inte följer med i produktionsbyggen.
- `demo/client.ts` – minnesbaserad ersättare för Supabase-klienten och
  edge-funktionerna (coins, upplåsning, Rose, boost).
- `demo/data.ts` – fiktiva profiler, matchningar och konversationer.
- `assets/demo/` – lokala demobilder, se [assets/demo/README.md](assets/demo/README.md).

Återställ demon: **Profil → Återställ demo**, eller ladda om appen.

## Vanligt läge (riktig backend)

1. Kopiera `.env.example` till `.env` och fyll i projektets Supabase-URL och
   publika anon-nyckel. `.env` är git-ignorerad och ska aldrig checkas in.
2. `npm start`

Databasschema och edge-funktioner ligger i `supabase/` och `supabase-*.sql`.

## Struktur

- `app/` – skärmar (Expo Router). `app/(tabs)/` är flikarna Utforska, Duos,
  Matcher, Coins och Profil.
- `components/` – delade komponenter, bl.a. `SwipeCard` och `MatchExperience`.
- `constants/` – färger, rörelse och stil (svart/guld-identiteten).
- `demo/` – demoläget.
- `scripts/demo.js` – startskriptet bakom `npm run demo`.
