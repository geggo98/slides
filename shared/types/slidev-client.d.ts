/**
 * Typ-Stub für `@slidev/client`, nur für den Typchecker (`bun run typecheck`).
 *
 * Der Client wird als Quell-`.ts` ohne `.d.ts` ausgeliefert. Ein direkter
 * Import zöge ~70 Fehler aus Slidevs eigenem Code in unsere strikte Prüfung
 * (`noUncheckedIndexedAccess`), die wir nicht beheben können — `skipLibCheck`
 * greift nur für `.d.ts`. Deshalb mappt `tsconfig.json` (`paths`) auf diese
 * Datei. Vite und Vitest lesen `paths` nicht; zur Laufzeit gilt der echte Client.
 *
 * Deklariert ist genau, was das Repo benutzt, Signaturen nach
 * `node_modules/@slidev/client` (geprüft gegen 52.14). Braucht eine Komponente
 * mehr, hier ergänzen. `shared/__tests__/slidev-client-stub.test.ts` meldet,
 * wenn ein Name aus dieser Datei im echten Client fehlt.
 */
import type { ComputedRef, Ref, UnwrapNestedRefs } from "vue";
import type { ClicksContext, SlideRoute, SlidevConfig } from "@slidev/types";

export function useDarkMode(): {
  isColorSchemaConfigured: Ref<boolean>;
  isDark: Ref<boolean>;
  toggleDark: (value?: boolean) => boolean;
};

/** Teilmenge von `SlidevContextNavFull` (composables/useNav.ts). */
export interface SlidevContextNav {
  slides: Ref<SlideRoute[]>;
  total: ComputedRef<number>;
  currentPage: ComputedRef<number>;
  currentSlideNo: ComputedRef<number>;
  currentLayout: ComputedRef<string>;
  currentTransition: ComputedRef<unknown>;
  navDirection: Ref<number>;
  clicksContext: ComputedRef<ClicksContext>;
  clicks: ComputedRef<number>;
  clicksTotal: ComputedRef<number>;
  isPrintMode: ComputedRef<boolean>;
  go: (no: number | string, clicks?: number, force?: boolean) => Promise<void>;
}
export function useNav(): SlidevContextNav;

/** Teilmenge von `SlideContext` (context.ts). */
export interface SlideContext {
  $slidev: UnwrapNestedRefs<{
    nav: SlidevContextNav;
    configs: SlidevConfig;
    themeConfigs: ComputedRef<SlidevConfig["themeConfig"]>;
  }>;
  $nav: Ref<SlidevContextNav>;
  $clicksContext: ClicksContext;
  $clicks: Ref<number>;
  $page: Ref<number>;
  $frontmatter: Record<string, unknown>;
}
export function useSlideContext(): SlideContext;

export function useIsSlideActive(): ComputedRef<boolean>;
export function onSlideEnter(cb: () => void): void;
export function onSlideLeave(cb: () => void): void;

export const configs: SlidevConfig;
export function handleBackground(
  background?: string,
  dim?: boolean,
  backgroundSize?: string,
): Record<string, string | undefined>;

declare module "vue" {
  // Slidev legt `$slidev`, `$clicks`, `$page` … in Templates frei
  // (client/shim-vue.d.ts).
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ComponentCustomProperties extends SlideContext {}
}
