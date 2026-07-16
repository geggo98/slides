// Interaktions-Test für den Agent-Lauf-Simulator (Folien 30/31, Port 3040).
// Playwright 1.58, Ausführung: bun run playwright-tests/anatomy-agent-sim.ts
// Achtung: Slidev hält Nachbarfolien gemountet — Locators immer mit
// .filter({ visible: true }) auf die sichtbare Folie einschränken.
import { chromium } from "playwright";

const PORT = process.env.PORT ?? "3040";
const BASE = `http://localhost:${PORT}`;

let failures = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch();

// --- Light-Theme-Context: Terminal-Pane muss trotzdem dunkel sein ---
{
  const ctx = await browser.newContext({
    colorScheme: "light",
    viewport: { width: 1280, height: 720 },
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/30`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const pane = page.locator(".sim-pane").filter({ visible: true }).first();
  const bg = await pane.evaluate((el) => getComputedStyle(el).backgroundColor);
  check(
    "Terminal-Pane bleibt im Light-Theme dunkel",
    bg === "rgb(26, 26, 26)",
    bg,
  );

  // Play drücken, warten bis die Ticketsuche erscheint
  await page
    .getByRole("button", { name: "Abspielen" })
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForTimeout(11_000);
  const tickets = page
    .getByText("3 offene Tickets: PROJ-1041 · PROJ-1042 · PROJ-1043")
    .first();
  check(
    "Autoplay erreicht die Ticketsuche",
    await tickets.isVisible().catch(() => false),
  );

  // Live-Umschalter → Codex: while-true-Wrapper + gpt-5.6-sol ultra sichtbar
  await page
    .getByRole("button", { name: "Codex CLI" })
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForTimeout(400);
  const wrapper = page.getByText("while true; do codex exec").first();
  check(
    "Codex-Modus zeigt while-true-Wrapper (kein /loop)",
    await wrapper.isVisible().catch(() => false),
  );
  const solUltra = page.getByText("gpt-5.6-sol ultra").first();
  check(
    "Codex-Hauptmodell gpt-5.6-sol ultra",
    await solUltra.isVisible().catch(() => false),
  );

  // Token-Kontinuität: client-seitig weiterblättern (wie im Vortrag) —
  // ein goto wäre ein Full-Reload und würde den Modul-Zustand zurücksetzen.
  // Slidev-Nav-API statt Tastatur (Fokus hängt sonst auf dem Toggle-Button).
  const hasNav = await page.evaluate(() =>
    Boolean((window as any).__slidev__?.nav),
  );
  if (hasNav) {
    await page.evaluate(() => (window as any).__slidev__.nav.go(31));
  } else {
    await page.locator("body").press("ArrowRight");
  }
  await page.waitForURL(/\/31/, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  check(
    "Client-Navigation auf Folie 31",
    page.url().includes("/31"),
    page.url(),
  );
  const mainTile = page
    .locator(".sim-tile-value")
    .filter({ visible: true })
    .first();
  const mainVal = (await mainTile.textContent())?.trim() ?? "";
  check(
    "Token-Zähler läuft auf Folie 31 weiter (>0 ohne Play)",
    mainVal !== "0" && mainVal !== "",
    mainVal,
  );

  // Codex-Modus (geteilter Zustand vom Umschalter auf Folie 30):
  // generierter Prompt als Ciphertext + #28058
  await page
    .getByRole("button", { name: "Schritt vor" })
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForTimeout(400);
  const cipher = page.getByText("enc:v2:gAAAAAB").first();
  check(
    "Codex: Subagent-Prompt nur als Ciphertext",
    await cipher.isVisible().catch(() => false),
  );
  const issueLink = page
    .getByRole("link", { name: "openai/codex#28058" })
    .filter({ visible: true })
    .first();
  check(
    "Codex: Verweis auf Issue #28058",
    await issueLink.isVisible().catch(() => false),
  );

  // Zurück zu Claude: Prompt im Klartext
  await page
    .getByRole("button", { name: "Claude Code" })
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForTimeout(400);
  const clearPrompt = page.getByText("Du testest Ticket PROJ-1043").first();
  check(
    "Claude: Subagent-Prompt im Klartext",
    await clearPrompt.isVisible().catch(() => false),
  );

  await page.screenshot({
    path: "playwright-tests/agent-sim-qa/interact-31-claude-prompt.png",
  });
  await ctx.close();
}

// --- Dark-Context: Deep-Link auf /31 (Full-Load) + Codex-Zoom-Screenshot ---
{
  const ctx = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 1280, height: 720 },
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/31`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // Nach Deep-Link muss die Übersicht als abgeschlossen zählen (32.400).
  const deepVal =
    (
      await page
        .locator(".sim-tile-value")
        .filter({ visible: true })
        .first()
        .textContent()
    )?.trim() ?? "";
  check(
    "Deep-Link /31: Übersichtslauf zählt als komplett",
    deepVal === "32.400",
    deepVal,
  );
  await page
    .getByRole("button", { name: "Codex CLI" })
    .filter({ visible: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Schritt vor" })
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "playwright-tests/agent-sim-qa/interact-31-codex-cipher.png",
  });

  // Beide Folien in Codex-Modus komplett durchsteppen: kein horizontaler
  // Overflow im Terminal-Pane (lange Exec-Results, Wrapper, Diff-Pager).
  for (const slide of [31, 30]) {
    await page.evaluate((n) => (window as any).__slidev__.nav.go(n), slide);
    await page.waitForTimeout(600);
    const fwd = page
      .getByRole("button", { name: "Schritt vor" })
      .filter({ visible: true })
      .first();
    for (let i = 0; i < 15 && (await fwd.isEnabled()); i++) {
      await fwd.click();
      await page.waitForTimeout(120);
    }
    const paneEl = page.locator(".sim-pane").filter({ visible: true }).first();
    const overflowX = await paneEl.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    check(
      `Folie ${slide} (Codex, Ende): kein horizontaler Overflow`,
      overflowX <= 1,
      `scrollWidth-clientWidth=${overflowX}`,
    );
    await page.screenshot({
      path: `playwright-tests/agent-sim-qa/interact-${slide}-codex-end.png`,
    });
  }
  await ctx.close();
}

await browser.close();
console.log(
  failures
    ? `\n${failures} Prüfung(en) fehlgeschlagen`
    : "\nAlle Prüfungen bestanden",
);
process.exit(failures ? 1 : 0);
