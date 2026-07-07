// Single source of truth für Deck-übergreifende Links. Alle Querverweise laufen
// über <TalkXref slug="…">, das die kanonische GitHub-Pages-URL aus dieser Basis
// baut. Ein Broken-Link-Check kann die TALKS-Keys gegen die Talk-Verzeichnisse
// abgleichen — Basis-URL und Slug→Titel leben damit an genau einer Stelle.
export const TALK_BASE_URL = "https://geggo98.github.io/slides/";

// slug (= Talk-Verzeichnisname) → Kurztitel (Fallback-Linktext).
export const TALKS = {
  "20260327-ai-agents": "AI Coding Agents",
  "20260327-gradle-dependency-resolution":
    "Gradle Dependency Resolution & Locking",
  "20260329-grafana-lgtm-monitoring-in-k8s-distributed-system":
    "Grafana LGTM Monitoring",
  "20260408-agents-details": "Wie funktioniert ein Coding-Agent?",
  "20260428-java-null-pointer": "Java Null-Sicherheit 2026",
  "20260522-open-rewrite": "OpenRewrite — Refactoring at Scale",
  "20260606-design-pattern": "Brauchen wir noch Entwurfsmuster?",
  "20260703-rnext-proposal": "BiPRO RNext — OpenAPI für LLM-Agents",
  "20260707-anatomy-of-autonomous-agents": "Anatomie Autonomer Agenten",
} as const;

export type TalkSlug = keyof typeof TALKS;

// Kanonische URL eines Decks, optional mit Slide-Anker.
//
// `anchor` ist ein **Pfad-Segment** im Ziel-Deck — bevorzugt ein `routeAlias`
// aus dem Frontmatter der Ziel-Folie (kebab-case), notfalls eine Folien-Nummer.
// Warum Pfad statt Hash: alle Decks laufen im Slidev-Default `routerMode:
// history` (kein Deck setzt routerMode im Headmatter); vue-router ignoriert
// dort `#/…`-Fragmente fürs Routing, ein Hash-Anker würde also nicht
// navigieren. Pfad-Deeplinks funktionieren in beiden Umgebungen:
//   - Dev-Server (base "/"): http://localhost:<port>/<anchor> direkt.
//   - GitHub Pages: die devenv-Task `slides:spa-redirect` deployt eine
//     404.html, die /<base>/<deck>/<anchor> auf /<base>/<deck>/?__spa=/<anchor>
//     umleitet; ein in jedes index.html injiziertes Head-Script macht daraus
//     per history.replaceState **vor** App-Boot wieder /<anchor>, das
//     vue-router als (Alias-)Route auflöst. Live verifiziert.
//
// Konvention: Cross-Deck-Ziele bekommen im Ziel-Deck ein `routeAlias` —
// Folien-Nummern verschieben sich beim Editieren, Aliasse nicht.
export function talkUrl(slug: string, anchor?: string | number): string {
  const base = `${TALK_BASE_URL}${slug}/`;
  if (anchor === undefined || anchor === "") return base;
  // Führende Slashes tolerieren ("/jspecify" ≙ "jspecify"), Doppel-Slash vermeiden.
  return base + String(anchor).replace(/^\/+/, "");
}
