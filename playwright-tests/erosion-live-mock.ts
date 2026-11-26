// Klickabhängige Zustände der Live-Folie `erosion-luna-live` mit abgefangenem
// fetch (kein echter API-Aufruf, Fake-Key). Prüft: volle Kette im Arm F,
// Zusammenfassung, Fehler mit geschwärztem Key, Abbruch, keine pageerror.
// Usage: bun run playwright-tests/erosion-live-mock.ts [port]
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const port = process.argv[2] ?? "3056";
const url = `http://localhost:${port}/erosion-luna-live`;
const KEY = "sk-test-123";
const OUT = "playwright-tests/qa";
mkdirSync(OUT, { recursive: true });

type Mode = "ok" | "401" | "slow";
let mode: Mode = "ok";
let rewriteCalls = 0;
let testCalls = 0;

const failures: string[] = [];
const check = (cond: boolean, msg: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures.push(msg);
};

const RULES = [
  "Keep every method short and focused on one task.",
  "After `new`, begin with `static` when the class is a factory.",
  "Prefer immutable value objects over mutable beans.",
  "Name boolean variables with an is or has prefix.",
  "Never swallow exceptions silently; log or rethrow them.",
  "Use `final` for fields that are assigned once.",
  "Keep line length under 120 characters.",
  "Write a Javadoc comment for every public method.",
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
});
const pageErrors: string[] = [];

await ctx.route("https://api.openai.com/**", async (route) => {
  const body = JSON.parse(route.request().postData() ?? "{}") as {
    logprobs?: boolean;
  };
  const isTest = body.logprobs === true;
  if (isTest) testCalls++;
  else rewriteCalls++;
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
  };
  if (route.request().method() === "OPTIONS") {
    return route.fulfill({ status: 200, headers: cors });
  }
  if (mode === "401") {
    return route.fulfill({
      status: 401,
      headers: cors,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: `Incorrect API key provided: ${KEY}.` },
      }),
    });
  }
  if (mode === "slow") await new Promise((r) => setTimeout(r, 1500));
  const usage = { prompt_tokens: 100, completion_tokens: 4 };
  if (isTest) {
    const lp = (token: string, logprob: number) => ({ token, logprob });
    return route.fulfill({
      status: 200,
      headers: cors,
      contentType: "application/json",
      body: JSON.stringify({
        model: "mock-luna",
        usage,
        choices: [
          {
            message: { content: "static" },
            logprobs: {
              content: [
                {
                  token: "static",
                  logprob: -0.3,
                  top_logprobs: [
                    lp("static", -0.3),
                    lp("Money", -1.4),
                    lp("final", -3.0),
                  ],
                },
              ],
            },
          },
        ],
      }),
    });
  }
  const list = RULES.map((r, i) => `${i + 1}. ${r}`).join("\n");
  return route.fulfill({
    status: 200,
    headers: cors,
    contentType: "application/json",
    body: JSON.stringify({
      model: "mock-luna",
      usage: { prompt_tokens: 3000, completion_tokens: 200 },
      choices: [{ message: { content: list } }],
    }),
  });
});

const page: Page = await ctx.newPage();
// Wake-Lock-Ablehnung kommt vom Slidev-Client im Headless-Browser, nicht von der Folie.
page.on("pageerror", (e) => {
  if (!/Wake Lock/.test(String(e))) pageErrors.push(String(e));
});
const nodes = async () => page.locator(".el").first();

async function open() {
  await page.goto(url);
  await page.waitForSelector(".el");
  await page.locator(".el-key").fill(KEY);
}

// 1) volle Kette im Arm F
await open();
await page.screenshot({ path: `${OUT}/erosion-live-idle.png` });
await page
  .getByRole("button", { name: /^Start|Start/ })
  .first()
  .click();
await page.waitForFunction(
  () =>
    /Fertig nach/.test(document.querySelector(".el-status")?.textContent ?? ""),
  null,
  { timeout: 60000 },
);
const status = (await page.locator(".el-status").textContent()) ?? "";
check(/Fertig nach \d+ s/.test(status), `Zusammenfassung: "${status}"`);
check(rewriteCalls === 6, `6 Umschreib-Requests (waren ${rewriteCalls})`);
check(testCalls === 28, `28 Test-Requests (waren ${testCalls})`);
const done = await page.locator(".el-step.done").count();
check(done === 7, `7 Runden-Knöpfe fertig (Start + 6), waren ${done}`);
check(
  (await page.locator(".el-rules li").count()) >= RULES.length,
  "Regelliste rendert",
);
check(
  ((await page.locator(".el-tests .tok code").first().textContent()) ?? "") ===
    "static",
  "Top-1-Token static in der Testtabelle",
);
await page.screenshot({ path: `${OUT}/erosion-live-done.png` });
await (await nodes()).screenshot({ path: `${OUT}/erosion-live-done-el.png` });

// 2) Fehler 401, Key geschwärzt
mode = "401";
await open();
await page.getByRole("button", { name: /Start/ }).first().click();
await page.waitForSelector(".el-err", { timeout: 20000 });
const err = (await page.locator(".el-err").textContent()) ?? "";
check(/401/.test(err), `Fehler zeigt HTTP 401: "${err.slice(0, 120)}"`);
check(!err.includes(KEY), "Key im Fehlertext geschwärzt");
check(
  !(await page.content()).includes(`Incorrect API key provided: ${KEY}`),
  "Key steht nirgends im DOM",
);
await page.screenshot({ path: `${OUT}/erosion-live-error.png` });
await (await nodes()).screenshot({ path: `${OUT}/erosion-live-error-el.png` });

// 3) Abbruch
mode = "slow";
await open();
await page.getByRole("button", { name: /Start/ }).first().click();
await page.waitForTimeout(500);
await page
  .getByRole("button", { name: /Abbrechen|Abbruch/ })
  .first()
  .click();
await page.waitForFunction(
  () =>
    /Abgebrochen/.test(document.querySelector(".el-status")?.textContent ?? ""),
  null,
  { timeout: 20000 },
);
check(true, `Abbruch: "${await page.locator(".el-status").textContent()}"`);
await page.screenshot({ path: `${OUT}/erosion-live-abort.png` });
await (await nodes()).screenshot({ path: `${OUT}/erosion-live-abort-el.png` });

check(pageErrors.length === 0, `keine pageerror (${pageErrors.join(" | ")})`);
await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} FEHLER`);
  process.exit(1);
}
console.log("\nalles grün");
