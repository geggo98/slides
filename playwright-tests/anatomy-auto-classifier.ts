// Verifikation: Auto-Klassifikator-Kontrast auf Folie /30.
// Codex → Freigabe-Box (CodexPermissions); Claude → Klassifikator-Zeile.
// Playwright 1.58, Ausführung: bun run playwright-tests/anatomy-auto-classifier.ts
import { chromium } from "playwright";

const PORT = process.env.PORT ?? "3040";
const BASE = `http://localhost:${PORT}`;

let failures = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  colorScheme: "dark",
  viewport: { width: 1280, height: 720 },
});
const page = await ctx.newPage();
await page.goto(`${BASE}/30`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);

// Bis zum guard-Schritt (Index 5) vorspulen: 6× Schritt vor.
async function stepTo() {
  const fwd = page
    .getByRole("button", { name: "Schritt vor" })
    .filter({ visible: true })
    .first();
  for (let i = 0; i < 6 && (await fwd.isEnabled()); i++) {
    await fwd.click();
    await page.waitForTimeout(120);
  }
}

// --- Codex: Freigabe-Box ---
{
  await page
    .getByRole("button", { name: "Codex CLI" })
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForTimeout(200);
  await stepTo();
  const title = page
    .getByText("Zugriff außerhalb der Sandbox — freigeben?")
    .first();
  check(
    "Codex /30: Freigabe-Box (Titel) sichtbar",
    await title.isVisible().catch(() => false),
  );
  const cmd = page
    .locator(".ev-approval-cmd")
    .filter({ visible: true })
    .first();
  const cmdText = (await cmd.textContent().catch(() => ""))?.trim() ?? "";
  check(
    "Codex /30: curl-Befehl in der Box",
    cmdText.includes("curl https://preis-service.staging.internal/health"),
    cmdText,
  );
  const optJa = page.getByText("Diesen Befehl einmalig ausführen").first();
  check(
    "Codex /30: Freigabe-Option Ja gerendert (CodexPermissions)",
    await optJa.isVisible().catch(() => false),
  );
  // Claude-Klassifikator-Zeile darf im Codex-Modus NICHT erscheinen.
  const classifierInCodex = await page
    .getByText("Auto-Classifier (serverseitig)")
    .first()
    .isVisible()
    .catch(() => false);
  check("Codex /30: kein Klassifikator-Hinweis", !classifierInCodex);
  await page.screenshot({
    path: "playwright-tests/agent-sim-qa/classifier-30-codex.png",
  });
}

// --- Claude: Klassifikator-Zeile statt Box ---
{
  await page
    .getByRole("button", { name: "Claude Code" })
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForTimeout(300);
  const classifier = page.getByText("Auto-Classifier (serverseitig)").first();
  check(
    "Claude /30: Klassifikator-Hinweis sichtbar",
    await classifier.isVisible().catch(() => false),
  );
  const ok = page.getByText("200 OK").first();
  check(
    "Claude /30: curl läuft durch (200 OK)",
    await ok.isVisible().catch(() => false),
  );
  const boxInClaude = await page
    .getByText("Zugriff außerhalb der Sandbox — freigeben?")
    .first()
    .isVisible()
    .catch(() => false);
  check("Claude /30: keine Freigabe-Box", !boxInClaude);
  await page.screenshot({
    path: "playwright-tests/agent-sim-qa/classifier-30-claude.png",
  });
}

// --- Footer-Link auf permission-modes ---
{
  const link = page
    .getByRole("link", { name: "Klassifikator" })
    .filter({ visible: true })
    .first();
  const href = (await link.getAttribute("href").catch(() => "")) ?? "";
  check(
    "Footer /30: TalkXref-Link zeigt auf permission-modes",
    href.endsWith("/20260327-ai-agents/permission-modes"),
    href,
  );
  const target = await link.getAttribute("target").catch(() => "");
  check(
    "Footer /30: Link öffnet in neuem Tab",
    target === "_blank",
    target ?? "",
  );
}

await ctx.close();
await browser.close();
console.log(
  failures
    ? `\n${failures} Prüfung(en) fehlgeschlagen`
    : "\nAlle Prüfungen bestanden",
);
process.exit(failures ? 1 : 0);
