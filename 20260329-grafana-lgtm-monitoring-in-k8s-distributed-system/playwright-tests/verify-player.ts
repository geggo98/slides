import { chromium } from "playwright";

const PORT = 3037;
const URL = `http://localhost:${PORT}/22`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run(theme: "light" | "dark") {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".slidev-page-22 .controls-row", {
    timeout: 15000,
  });

  const scope = ".slidev-page-22 ";
  const pct = async () => {
    const txt = await page
      .locator(scope + ".progress-pct")
      .first()
      .textContent();
    return parseInt((txt || "0").replace("%", ""), 10);
  };
  const severity = async () =>
    (
      await page
        .locator(scope + ".severity-badge")
        .first()
        .textContent()
    )?.trim();
  // Buttons by title
  const reset = page.locator(scope + 'button[title="Reset"]').first();
  const back = page.locator(scope + 'button[title="Stufe zurück"]').first();
  const play = page.locator(scope + 'button[title="Play / Pause"]').first();
  const fwd = page.locator(scope + 'button[title="Stufe vor"]').first();

  const results: string[] = [];
  const ok = (label: string, cond: boolean, extra = "") =>
    results.push(`${cond ? "✅" : "❌"} [${theme}] ${label} ${extra}`);

  // --- Req 5: Reset ---
  await reset.click();
  await sleep(150);
  ok("Reset → 0%", (await pct()) === 0, `(got ${await pct()}%)`);

  // --- Req 1: Play resumes (does not jump to 0) ---
  await play.click(); // play
  await sleep(2500); // ~31% of 8s sweep
  await play.click(); // pause
  await sleep(100);
  const paused = await pct();
  ok(
    "Play läuft & Pause hält an",
    paused > 10 && paused < 95,
    `(paused @ ${paused}%)`,
  );
  await play.click(); // resume
  await sleep(120);
  await play.click(); // pause immediately
  const resumed = await pct();
  ok(
    "Play setzt fort (kein Sprung auf 0)",
    resumed >= paused - 1,
    `(resumed @ ${resumed}% from ${paused}%)`,
  );

  // --- Req 1: stops at end ---
  await play.click(); // resume to end
  await sleep(9000);
  const ended = await pct();
  ok("Stoppt am Ende (100%)", ended === 100, `(got ${ended}%)`);

  // --- Req 2: Play at end restarts from 0 ---
  await play.click(); // at end → restart
  await sleep(150);
  await play.click(); // pause right after restart
  const restarted = await pct();
  ok("Play am Ende → von vorn", restarted < 20, `(restarted @ ${restarted}%)`);

  // --- Req 3/4: Stage forward/back land at midpoints with correct badge ---
  await reset.click();
  await sleep(150);
  await fwd.click(); // → Healthy mid ~12%
  await sleep(700);
  ok(
    "Stufe vor → Healthy-Mitte",
    Math.abs((await pct()) - 12) <= 3 && (await severity()) === "HEALTHY",
    `(@${await pct()}%, ${await severity()})`,
  );
  await fwd.click(); // → Degraded mid ~38%
  await sleep(800);
  ok(
    "Stufe vor → Degraded-Mitte",
    Math.abs((await pct()) - 38) <= 3 && (await severity()) === "DEGRADED",
    `(@${await pct()}%, ${await severity()})`,
  );
  await fwd.click(); // → Warning ~62%
  await sleep(800);
  ok(
    "Stufe vor → Warning-Mitte",
    Math.abs((await pct()) - 62) <= 3 && (await severity()) === "WARNING",
    `(@${await pct()}%, ${await severity()})`,
  );
  await fwd.click(); // → Critical ~88%
  await sleep(800);
  ok(
    "Stufe vor → Critical-Mitte",
    Math.abs((await pct()) - 88) <= 3 && (await severity()) === "CRITICAL",
    `(@${await pct()}%, ${await severity()})`,
  );
  const atCritical = await pct();
  await fwd.click(); // no-op at last midpoint
  await sleep(400);
  ok(
    "Stufe vor an Critical-Mitte = No-op",
    (await pct()) === atCritical,
    `(@${await pct()}%)`,
  );
  await back.click(); // → Warning ~62%
  await sleep(800);
  ok(
    "Stufe zurück → Warning-Mitte",
    Math.abs((await pct()) - 62) <= 3 && (await severity()) === "WARNING",
    `(@${await pct()}%, ${await severity()})`,
  );

  console.log(results.join("\n"));
  const failed = results.some((r) => r.startsWith("❌"));
  await browser.close();
  return failed;
}

const f1 = await run("light");
const f2 = await run("dark");
process.exit(f1 || f2 ? 1 : 0);
