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
} as const;

export type TalkSlug = keyof typeof TALKS;

export function talkUrl(slug: string): string {
  return `${TALK_BASE_URL}${slug}/`;
}
