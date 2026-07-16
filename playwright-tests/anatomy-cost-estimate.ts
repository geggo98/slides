// Verifikation der Kosten-Abschätzung im Agent-Lauf-Simulator (Folien 30/31).
// Playwright 1.58, Ausführung: bun run playwright-tests/anatomy-cost-estimate.ts
// Deep-Link /31 → activeView='zoom' → Übersichtslauf gilt als komplett, daher
// sind main/sub/run deterministisch (unabhängig vom Stepping).
import { chromium } from "playwright";

const PORT = process.env.PORT ?? "3040";
const BASE = `http://localhost:${PORT}`;

let failures = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

async function costs(page: import("playwright").Page) {
  const cells = await page
    .locator(".sim-tile-cost")
    .filter({ visible: true })
    .allTextContents();
  const run =
    (
      await page
        .locator(".sim-run-total")
        .filter({ visible: true })
        .first()
        .textContent()
    )
      ?.replace(/\s+/g, " ")
      .trim() ?? "";
  return { cells: cells.map((c) => c.trim()), run };
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  colorScheme: "dark",
  viewport: { width: 1280, height: 720 },
});
const page = await ctx.newPage();
await page.goto(`${BASE}/31`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// --- Claude (Default) ---
{
  const { cells, run } = await costs(page);
  check(
    "/31 Claude: Hauptagent-Kosten ≈ 15 ct",
    cells[0] === "≈ 15 ct",
    cells[0],
  );
  check(
    "/31 Claude: Subagents-Kosten ≈ 18 ct",
    cells[1] === "≈ 18 ct",
    cells[1],
  );
  check(
    "/31 Claude: Workflow-Kosten-Zelle vorhanden",
    cells.length === 3,
    `n=${cells.length}`,
  );
  check("/31 Claude: Lauf gesamt ≈ 33 ct", run.includes("≈ 33 ct"), run);
  await page.screenshot({
    path: "playwright-tests/agent-sim-qa/cost-31-claude.png",
  });
}

// --- Codex (Live-Umschalter, günstigeres Sub-Modell) ---
{
  await page
    .getByRole("button", { name: "Codex CLI" })
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForTimeout(400);
  const { cells, run } = await costs(page);
  check(
    "/31 Codex: Hauptagent-Kosten ≈ 11 ct",
    cells[0] === "≈ 11 ct",
    cells[0],
  );
  check("/31 Codex: Subagents-Kosten ≈ 2 ct", cells[1] === "≈ 2 ct", cells[1]);
  check("/31 Codex: Lauf gesamt ≈ 14 ct", run.includes("≈ 14 ct"), run);
  await page.screenshot({
    path: "playwright-tests/agent-sim-qa/cost-31-codex.png",
  });
}

// --- /30 Übersicht: Kosten rendern + Screenshot (Werte step-abhängig) ---
{
  await page
    .getByRole("button", { name: "Claude Code" })
    .filter({ visible: true })
    .first()
    .click();
  await page.evaluate(() => (window as any).__slidev__.nav.go(30));
  await page.waitForTimeout(700);
  const { cells, run } = await costs(page);
  check(
    "/30 Übersicht: 2 Kosten-Zellen (main+sub, kein Workflow)",
    cells.length === 2,
    `n=${cells.length}`,
  );
  check(
    "/30 Übersicht: Kosten-Zellen nicht leer",
    cells.every((c) => /\d/.test(c)),
    cells.join(" | "),
  );
  check("/30 Übersicht: Lauf-gesamt sichtbar", /\d/.test(run), run);
  await page.screenshot({
    path: "playwright-tests/agent-sim-qa/cost-30-claude.png",
  });
}

await ctx.close();
await browser.close();
console.log(
  failures
    ? `\n${failures} Prüfung(en) fehlgeschlagen`
    : "\nAlle Prüfungen bestanden",
);
process.exit(failures ? 1 : 0);
