# LoveBack – kom igång på en ny dator (Windows)

Den här guiden tar dig från en tom Windows-dator till att LoveBack rullar i
demoläge på din telefon. Du behöver inte kunna programmera. Räkna med
15–20 minuter första gången, varav det mesta är väntan på nedladdningar.

Demoläget använder bara påhittad data som ligger i projektet. Det krävs inga
lösenord eller nycklar, och inga riktiga användare berörs.

---

## 1. Installera tre program på datorn

Ladda ner och installera med standardvalen (klicka "Next" hela vägen):

| Program | Länk | Varför |
| --- | --- | --- |
| **Git** | https://git-scm.com/download/win | Hämtar projektet från GitHub |
| **Node.js (LTS)** | https://nodejs.org | Kör appen. Version 20 eller nyare krävs |
| **VS Code** | https://code.visualstudio.com | Programmet du öppnar projektet i |

Starta om datorn efteråt om något av programmen ber om det.

**Kontrollera:** öppna *Windows PowerShell* (sök på "PowerShell" i Start-menyn)
och skriv:

```powershell
git --version
node --version
```

Båda ska svara med ett versionsnummer. `node` ska visa `v20` eller högre.

## 2. Installera Expo Go på telefonen

- **iPhone:** App Store → sök "Expo Go" → installera.
- **Android:** Google Play → sök "Expo Go" → installera.

Du behöver inget Expo-konto.

## 3. Få åtkomst till projektet

Projektet ligger i ett privat GitHub-repository. Du behöver:

1. Ett GitHub-konto (gratis på https://github.com).
2. En inbjudan till repositoryt från ägaren. Du får ett mejl från GitHub –
   klicka **Accept invitation**.

## 4. Hämta projektet (klona)

Öppna PowerShell och kör följande. Byt ut `<REPO-ADRESS>` mot adressen du fått
av ägaren (den ser ut ungefär som `https://github.com/<konto>/loveback.git`):

```powershell
cd $HOME\Documents
git clone <REPO-ADRESS> loveback
```

Första gången öppnas ett fönster där du loggar in på GitHub. Gör det, så
fortsätter nedladdningen av sig själv.

## 5. Öppna projektet i VS Code

1. Starta VS Code.
2. **File → Open Folder…** och välj mappen `Documents\loveback`.
3. Frågar VS Code om du litar på upphovspersonerna, välj **Yes, I trust the authors**.
4. Öppna terminalen i VS Code: **Terminal → New Terminal**.

Alla kommandon härifrån skrivs i den terminalen.

## 6. Installera projektets paket

```powershell
npm install
```

Tar 2–5 minuter. Varningar i gult ("warn", "deprecated") är normala. Det är
klart när du får tillbaka en tom rad där du kan skriva igen.

## 7. Starta demoläget

```powershell
npm run demo
```

- Frågar Windows-brandväggen om Node.js ska få åtkomst: bocka i **Privata
  nätverk** och klicka **Tillåt åtkomst**.
- Efter ungefär en minut visas en stor QR-kod i terminalen.

Demoläget aktiveras av just det här kommandot – du behöver inte ställa in
något annat och ingen `.env`-fil behövs.

## 8. Öppna appen på telefonen

Telefonen och datorn måste vara på **samma wifi**.

- **iPhone:** öppna Kamera-appen, rikta den mot QR-koden och tryck på den gula
  länken som dyker upp. Expo Go öppnas.
- **Android:** öppna Expo Go och tryck **Scan QR code**.

Första laddningen tar 30–60 sekunder. När LoveBack-loggan visas: tryck
**Starta demo**.

Du är igång. Under loggan överst står det "DEMOLÄGE" så att det alltid syns
att det är demodata.

## 9. Återställa demon

Vill du börja om från början (alla svep, matchningar och coins återställs):

- I appen: **Profil** → scrolla längst ner → **Återställ demo**, eller
- i terminalen: tryck `r` för att ladda om appen.

## 10. Avsluta och starta igen

- **Avsluta:** klicka i terminalen och tryck `Ctrl + C`.
- **Starta igen en annan dag:** öppna mappen i VS Code, öppna terminalen och
  kör `npm run demo`. Steg 1–6 behöver inte göras om.

## 11. Hämta senaste ändringarna

När ägaren har gjort uppdateringar:

```powershell
git pull
npm install
npm run demo
```

---

## Felsökning

**Telefonen hittar inte appen / laddar i evighet / "Could not connect"**
Vanligast på jobb-, hotell- och gästnät som hindrar enheter från att prata
med varandra. Avsluta med `Ctrl + C` och kör i stället:

```powershell
npm run demo:tunnel
```

Det tar lite längre tid att starta men fungerar över nästan alla nät.
Ett annat säkert alternativ är att dela internet från telefonen (personlig
hotspot) och ansluta datorn till den.

**Reservplan: visa appen i datorns webbläsare**

```powershell
npm run demo:web
```

Appen öppnas i webbläsaren. Bra att ha i bakfickan om telefonen krånglar.
Gör fönstret smalt, så liknar det en telefon.

**"npm kan inte läsas in eftersom körning av skript har inaktiverats"**
Kör det här en gång och försök igen:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

**"git" eller "npm" känns inte igen**
Programmet är inte installerat, eller så öppnades terminalen före
installationen. Stäng VS Code och PowerShell helt, öppna igen och prova på nytt.

**"Node.js … är för gammal"**
Installera senaste LTS-versionen från https://nodejs.org och starta om VS Code.

**"Projektets paket är inte installerade ännu"**
Kör `npm install` och sedan `npm run demo`.

**Expo Go säger att projektet använder en annan SDK-version**
Uppdatera Expo Go i App Store / Google Play till senaste versionen.

**Appen ser konstig ut eller har fastnat**
Tryck `r` i terminalen för att ladda om. Hjälper inte det: `Ctrl + C` och
`npm run demo` igen.

**Porten är upptagen ("Port 8081 is being used")**
Svara `y` på frågan om att använda en annan port, eller stäng andra
terminalfönster där appen redan körs.

---

## Bra att veta

- Allt i demoläget är påhittat: namn, bilder, meddelanden och saldon.
- Inget du gör i demoläget sparas eller skickas någonstans. Stänger du appen
  börjar den om från start nästa gång.
- Köp av Coins i demoläget är simulerade – inga pengar dras.
