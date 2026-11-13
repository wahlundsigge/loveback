#!/usr/bin/env node
/* global __dirname */
/**
 * Starts LoveBack in Demo Mode:  npm run demo
 *
 * Demo Mode runs entirely on fictional, local data (see demo/). It needs no
 * .env file, no Supabase credentials and no network access to the backend.
 *
 *   npm run demo            phone and computer on the same Wi-Fi
 *   npm run demo:tunnel     different networks / locked-down Wi-Fi
 *   npm run demo:web        open in the browser on this computer
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const fail = (lines) => {
  console.error("\n  ✖ " + lines.join("\n    ") + "\n");
  process.exit(1);
};

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  fail([
    `Node.js ${process.versions.node} är för gammal — LoveBack kräver Node.js 20 eller nyare.`,
    "Installera senaste LTS-versionen från https://nodejs.org och försök igen.",
  ]);
}

let expoCli;
try {
  if (!fs.existsSync(path.join(root, "node_modules"))) throw new Error("no node_modules");
  expoCli = require.resolve("expo/bin/cli", { paths: [root] });
} catch {
  fail([
    "Projektets paket är inte installerade ännu.",
    "Kör först:  npm install",
    "och sedan:  npm run demo",
  ]);
}

const extraArgs = process.argv.slice(2);
const mode = extraArgs.includes("--tunnel") ? "tunnel" : extraArgs.includes("--web") ? "web" : "lan";

console.log(`
  ┌──────────────────────────────────────────────────────────┐
  │  LOVEBACK · DEMOLÄGE                                     │
  │  Fiktiv data — ingen kontakt med riktiga användare       │
  └──────────────────────────────────────────────────────────┘
${mode === "web"
    ? "  Appen öppnas i webbläsaren när den är klar."
    : `  1. Installera appen "Expo Go" på telefonen (App Store / Google Play).
  2. Vänta tills en QR-kod visas här nedanför (första starten tar ~1 minut).
  3. iPhone: skanna QR-koden med Kamera-appen.  Android: skanna i Expo Go.
  4. Tryck "Starta demo" i appen.`}
${mode === "lan" ? "\n  Hittar telefonen inte appen? Avsluta med Ctrl+C och kör:  npm run demo:tunnel\n" : ""}
  Återställ demon: Profil → "Återställ demo" (eller starta om med Ctrl+C + npm run demo).
`);

const child = spawn(process.execPath, [expoCli, "start", "--clear", ...extraArgs], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, EXPO_PUBLIC_DEMO_MODE: "1" },
});

child.on("error", (err) => fail(["Kunde inte starta Expo:", err.message]));
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
