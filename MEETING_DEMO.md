# LoveBack – demomanus (3–5 minuter)

Manus för att visa LoveBack i demoläge. Installation och start beskrivs i
[MEETING_SETUP.md](MEETING_SETUP.md).

## Före mötet (5 minuter)

1. Starta med `npm run demo` och öppna appen på telefonen via Expo Go.
2. Tryck **Starta demo** och kontrollera att första kortet är **Elsa, 26**.
3. Har du klickat runt: **Profil → Återställ demo**, så är allt tillbaka i
   startläget (saldo 1 240 Coins, Elsa överst).
4. Telefonen: ljusstyrka på max, Stör ej på, laddad. Ha `npm run demo:web`
   som reservplan om nätverket krånglar.

Demon är uppbyggd så att stegen nedan alltid ger samma resultat efter en
återställning.

---

## Manus

### 1. Första intrycket – identiteten (20 s)

*Visa startskärmen innan du trycker Starta demo.*

> "LoveBack är en dejtingapp med premiumkänsla. Svart och guld, mycket luft,
> inget plotter. Guld används bara för det som är viktigt – det ska kännas
> exklusivt genom återhållsamhet, inte genom effekter."

Tryck **Starta demo**.

### 2. Utforska – svepa (60 s)

*Du står på fliken Utforska med Elsa överst.*

- **Tryck på höger sida av bilden** – nästa foto. Vänster sida – tillbaka.
  Strecken överst visar var du är.
- **Dra kortet långsamt åt höger** och håll kvar: stämpeln "JA TACK" tonar in
  och kortet bakom växer fram. Släpp tillbaka – kortet fjädrar hem.
- **Svep Elsa åt vänster** (nej tack).
- **Svep Maja åt höger** (ja tack). Ingen match – precis som i verkligheten.

> "Ett kort i taget, stora bilder, tydliga val. Man trycker för att bläddra
> bland bilderna och sveper för att bestämma sig – eller använder knapparna
> under kortet."

### 3. Matchögonblicket (45 s)

*Nästa kort är Saga. Hon har redan gillat dig.*

- **Svep Saga åt höger.** Matchupplevelsen öppnas: porträtten glider ihop,
  en guldring pulserar ut och telefonen ger en liten vibration.

> "Det här är appens viktigaste ögonblick, så det har fått en egen stund.
> Lugnt och elegant – ingen konfetti."

- Tryck **Lås upp chatten · 80 ✦**. Saldot sjunker från 1 240 till 1 160
  (syns uppe till höger när du är tillbaka på Utforska).

> "Här ligger affärsmodellen: en match är gratis, men det kostar Coins att
> öppna samtalet. Den som tar första steget betalar, och den andra får en
> liten belöning."

- Tryck **Skriv till Saga**. Chatten öppnas, och efter ett par sekunder
  skriver Saga ett första meddelande (förinspelat i demon).

### 4. Matchningar och chatt (60 s)

*Gå tillbaka och tryck på fliken Matcher (pratbubblan).*

- Överst: nya matchningar. Hänglåset betyder att chatten inte är upplåst än.
- **Öppna Wilma** och skicka ett meddelande. Efter ett par sekunder kommer ett
  svar (förinspelat i demon).
- Gå tillbaka och **öppna Linnea** – hon har skickat en **Rose**, ett sätt
  att skriva direkt utan att vänta på match. **Svara henne**: du får
  +150 Coins som belöning.

> "Rosen är vår premiumgest. Den kostar 300 Coins att skicka, och mottagaren
> belönas för att svara. Det gör att seriösa meddelanden faktiskt blir lästa."

- *Om tiden räcker:* öppna **Ebba** för att visa hur en låst chatt ser ut.

### 5. Duos (30 s, kan hoppas över)

*Tryck på fliken Duos.*

> "Duos är det som skiljer oss från alla andra: du och en vän bildar ett par
> och matchar med ett annat vänpar. Dubbeldejt, fast på riktigt."

- **Svep Tuva & Stella åt höger** – det blir en Duo-match med samma
  matchupplevelse, nu med fyra porträtt.

### 6. Profil (30 s)

*Tryck på fliken Profil.*

- Visa profilbilden och bildrutnätet.
- Tryck på **Förnamn**, ändra namnet – rubriken uppdateras direkt.
- Tryck **Förhandsgranska** uppe till höger: så här ser andra din profil.

### 7. Coins (15 s)

*Tryck på fliken Coins (plånboken).*

> "Här ser man saldo och historik. Coins köps i paket och används för att
> låsa upp chattar, skicka Rosor och boosta sin profil."

### 8. Avslutning – visionen (20 s)

> "Det ni har sett är en fungerande app, inte en bildpresentation. Flödena är
> desamma som i den riktiga versionen – skillnaden är att profilerna här är
> påhittade. Nästa steg är riktiga betalningar och en första stängd grupp
> testanvändare. Målet är inte den största dejtingappen, utan den som känns
> mest exklusiv."

---

## Vad är riktigt och vad är demo?

Säg hellre för lite än för mycket. Så här ligger det till:

### Byggt och fungerar i appen

- Svepkort med bildbläddring, ja/nej via svep eller knappar, filter.
- Matchning och matchupplevelsen.
- Upplåsning av chatt med Coins, inklusive belöning till motparten.
- Chatt med meddelanden i realtid.
- Rose (direktmeddelande) med belöning vid svar.
- Duos: bjud in en vän, svep på andra duos, duo-match och gruppchatt.
- Profil: bilder, uppgifter, vad man söker, förhandsgranskning.
- Plånbok med saldo och transaktionshistorik.
- Rapportera och blockera användare.

Allt ovan finns även mot den riktiga databasen (Supabase), med riktig
inloggning – demoläget kör samma skärmar.

### Demodata – påhittat

- Alla profiler, namn, åldrar, avstånd och texter.
- Alla bilder (stockfoton, se `assets/demo/README.md`).
- Alla konversationer. Svaren som kommer i chatten är förinspelade.
- Vilka som "redan gillat dig" (Saga, Ines, Tuva & Stella) är förberett så
  att demon alltid ger en match.
- Saldot 1 240 Coins och historiken i plånboken.

### Inte färdigt – säg det rakt om någon frågar

- **Betalningar:** det finns ingen riktig betallösning än. Köp av Coins är
  simulerade, även utanför demoläget. Priserna i appen är exempel.
- **App Store / Google Play:** appen är inte publicerad. Den körs via Expo Go.
- **ID-verifiering:** finns inte.
- **Väntelista / exklusiv inbjudan:** finns inte i appen.
- **Pushnotiser:** finns inte.
- **Riktiga användare:** det finns inga, bara testkonton.

---

## Om något går fel under demon

| Problem | Gör så här |
| --- | --- |
| Appen har fastnat | Skaka telefonen → **Reload**, eller tryck `r` i terminalen |
| Fel startläge | **Profil → Återställ demo** |
| Telefonen tappar anslutningen | Byt till datorn: `npm run demo:web` |
| Du svepte förbi Saga av misstag | Återställ demon – eller fortsätt: **Ines** (tre kort senare) ger också en match |
