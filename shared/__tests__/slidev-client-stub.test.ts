import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Hält den Typ-Stub `shared/types/slidev-client.d.ts` gegen den echten
// Slidev-Client. Der Stub ersetzt den Client nur für den Typchecker; ändert ein
// Slidev-Update die API, soll das hier auffallen statt erst im Editor.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p: string): string => readFileSync(resolve(repoRoot, p), "utf8");

const stub = read("shared/types/slidev-client.d.ts");
const client = (f: string): string => read(`node_modules/@slidev/client/${f}`);

// Quellen, über die `@slidev/client` (index.ts) seine Namen veröffentlicht.
const exportSources = [
  "index.ts",
  "env.ts",
  "layoutHelper.ts",
  "logic/slides.ts",
].map(client);

// matches:  export function useNav(): …   ->  "useNav"
//           export const configs: …       ->  "configs"
const stubExports = [
  ...stub.matchAll(/^export (?:function|const) (?<name>\w+)/gm),
].map((m) => m.groups!.name!);

const isExported = (name: string, sources: string[]): boolean =>
  sources.some(
    (src) =>
      new RegExp(
        `export\\s+(?:async\\s+)?(?:function|const)\\s+${name}\\b`,
      ).test(src) ||
      // matches:  export { onSlideEnter, onSlideLeave } from './logic/slides'
      [...src.matchAll(/export\s*\{(?<list>[^}]*)\}/g)].some((m) =>
        m.groups!.list!.split(",").some((n) => n.trim() === name),
      ),
  );

// matches:  currentPage: ComputedRef<number>   ->  "currentPage"
const memberNames = (body: string): string[] =>
  [...body.matchAll(/^\s{2}(?<name>\w+)\??:/gm)].map((m) => m.groups!.name!);

const interfaceBody = (src: string, name: string): string => {
  const start = src.indexOf(`export interface ${name}`);
  const end = src.indexOf("\n}", start);
  return start < 0 ? "" : src.slice(start, end);
};

describe("slidev-client Typ-Stub ↔ echter Client", () => {
  it("erkennt die Exporte des Stubs überhaupt (Kontrolle gegen blinden Scan)", () => {
    expect(stubExports.length).toBeGreaterThanOrEqual(7);
    expect(isExported("useNav", exportSources)).toBe(true);
    expect(isExported("gibtEsNichtImClient", exportSources)).toBe(false);
  });

  it.each(stubExports)("Client exportiert %s", (name) => {
    expect(isExported(name, exportSources)).toBe(true);
  });

  const navMembers = memberNames(interfaceBody(stub, "SlidevContextNav"));
  const realNav = client("composables/useNav.ts");

  it("Stub-Interface SlidevContextNav hat Mitglieder", () => {
    expect(navMembers.length).toBeGreaterThan(5);
  });

  it.each(navMembers)("useNav() liefert %s", (member) => {
    expect(realNav).toMatch(new RegExp(`\\b${member}\\??:`));
  });

  const ctxMembers = memberNames(interfaceBody(stub, "SlideContext"));
  const realCtx = client("context.ts");

  it.each(ctxMembers)("useSlideContext() liefert %s", (member) => {
    expect(realCtx).toMatch(new RegExp(`\\b${member.replace("$", "\\$")}\\b`));
  });
});
