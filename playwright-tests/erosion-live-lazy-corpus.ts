// Prüft, dass das große Live-Korpus (study9-live.json) erst beim Start eines
// Laufs geladen wird (dynamischer Import), nicht beim Öffnen anderer Folien.
// Usage: bun run playwright-tests/erosion-live-lazy-corpus.ts [port]
import { chromium } from "playwright";

const port = process.argv[2] ?? "3057";
const base = `http://localhost:${port}`;
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
});
const requests: string[] = [];
ctx.on("request", (r) => requests.push(r.url()));
await ctx.route("https://api.openai.com/**", async (route) => {
  const h = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
  };
  if (route.request().method() === "OPTIONS")
    return route.fulfill({ status: 200, headers: h });
  return route.fulfill({
    status: 401,
    headers: h,
    contentType: "application/json",
    body: JSON.stringify({ error: { message: "x" } }),
  });
});
const page = await ctx.newPage();
const corpusHits = () => requests.filter((u) => /study9-live/.test(u));
let fail = 0;
const check = (c: boolean, m: string) => {
  console.log(`${c ? "PASS" : "FAIL"}  ${m}`);
  if (!c) fail++;
};

for (const p of ["1", "5", "erosion-luna", "20"]) {
  await page.goto(`${base}/${p}`);
  await page
    .waitForSelector("[data-slidev-no]", { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(1500);
}
check(
  corpusHits().length === 0,
  `andere Folien: study9-live nicht angefordert (${corpusHits().length} Treffer)`,
);

await page.goto(`${base}/erosion-luna-live`);
await page.waitForSelector(".el");
await page.waitForTimeout(1500);
check(
  corpusHits().length === 0,
  `Live-Folie idle: Korpus nicht angefordert (${corpusHits().length} Treffer)`,
);

await page.locator(".el-key").fill("sk-test-123");
await page.getByRole("button", { name: /Start/ }).first().click();
await page.waitForFunction(
  () => document.querySelector(".el-err, .el-status")?.textContent,
  null,
  { timeout: 20000 },
);
await page.waitForTimeout(1000);
check(
  corpusHits().length >= 1,
  `nach Start: Korpus angefordert (${corpusHits().join(", ")})`,
);
await browser.close();
process.exit(fail ? 1 : 0);
