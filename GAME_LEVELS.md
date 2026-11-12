# LoveBack spel-progress

Det här dokumentet hjälper dig att följa projektet som om det vore ett spel med nivåer.

## Nivåer

### Level 1: Grundläggande app
- [x] Projektsetup med Expo
- [x] Supabase-klient i `app/lib/supabase.ts`
- [x] Profilskärm i `app/(tabs)/profile.tsx`
- [x] Enkel swipe-skärm i `app/(tabs)/swipe.tsx`

### Level 2: Swipe + filter
- [x] Visa kort med namn, ålder och bio
- [x] Hoppa över och gilla
- [x] Filter för ålder och maxdistans
- [x] Oändlig swipeloop

### Level 3: Matchning + betal-låsning
- [x] Matchning när två användare gillar varandra
- [x] Match-modul som säger "Match!"
- [x] Lås upp namn och chat för 7,99 kr
- [x] Kickback på 2 kr till andra parten
- [x] Wallet-saldo i swipe-vyn

### Level 4: Matchlista och chatt
- [x] Visa översikt över alla matchade par
- [x] Skapa chattvy för upplåsta matcher
- [x] Begränsa chatt till upplåsta matchningar
- [x] Visa namn/bild först efter betalning
- [x] Realtidschatt med live-uppdateringar

### Level 5: Polering och release
- [ ] Bättre profilbilder / avatarer
- [ ] Riktiga betalningar (Stripe / Supabase Functions)
- [ ] Onboarding / tutorial
- [ ] UI-förbättringar och animationer
- [ ] Testning och buggfixar

## Var är vi nu?
Just nu är vi i **Level 4** med refaktorerad struktur.

Vi har:
- ✅ Proper auth-gate (login bara vid första start)
- ✅ Komplett matchlista och chattvy
- ✅ Betallåst chatt med kickback-system
- ✅ Renare profilsida (Tinder-inspirerad)
- ✅ Logout-funktion
- ✅ Borttagning av onödiga sidor (index, extra auth)