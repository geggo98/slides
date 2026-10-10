/**
 * Typ-Stub für `@slidev/client/setup/shiki.ts`, siehe `slidev-client.d.ts`. Der
 * echte Client ist TypeScript-Quelltext und zieht das virtuelle Modul
 * `#slidev/setups/shiki` nach, das der Typchecker nicht kennt. Nur die Namen,
 * die `shared/components/QueryCode.vue` braucht.
 */
declare const setup: () => Promise<{
  languageNames: Set<string>;
  defaultHighlightOptions: Record<string, unknown>;
  getEagerHighlighter: () => Promise<{
    codeToHtml: (code: string, options: Record<string, unknown>) => string;
  }>;
}>;
export default setup;
