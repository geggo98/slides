<script setup lang="ts">
import { ref } from "vue";
import BunIcon from "./BunIcon.vue";
import BunPopover from "./BunPopover.vue";

// Bonus-Slide 3: vier Kritikpunkte am Bun-Rewrite als klickbare Karten;
// Popup je Karte mit Details (t) und Gegenposition/Einordnung (g).
const cards: {
  icon: string;
  warn?: boolean;
  title: string;
  sub: string;
  h: string;
  t: string;
  g: string;
}[] = [
  {
    icon: "alert-triangle",
    warn: true,
    title: "13.365 unsafe-Blöcke",
    sub: "~4 % des Rust-Codes, Dichte ~2× Deno. 5 unsound-Funktionen mit echtem UB, Miri-Fails zum Merge-Zeitpunkt.",
    h: "13.365 unsafe-Blöcke — was steckt dahinter?",
    t: "Buns eigenes Audit (21. Mai): ~29,8 % sind normale FFI-Grenzen zu JavaScriptCore und BoringSSL, ~33,9 % aus Zig übernommene Ownership-Muster. ~9.300 Blöcke sind in safe Rust überführbar, ~4.000 bleiben dauerhaft. Schwerer wiegen 5 als unsound markierte Funktionen — echtes Undefined Behavior, erreichbar aus safe Rust — und Miri-Fails zum Merge-Zeitpunkt.",
    g: "Gegenposition (Jarred): nur ~4 % des Codes, 78 % der Blöcke einzeilig (C-Pointer, C-Aufrufe); Miri-CI im Tree-Borrows-Modell wurde für alle FFI-freien Crates nachgerüstet, die Zahl soll beim Refactoring Richtung idiomatischem Rust sinken.",
  },
  {
    icon: "message-2",
    title: "Zig-Schöpfer: „unreviewed slop“",
    sub: "Andrew Kelley: Das Problem war Engineering-Disziplin in Buns Codebase, nicht die Sprache Zig.",
    h: "Andrew Kelleys Replik (9. Juli)",
    t: "Kelley ist Schöpfer der Sprache Zig; Bun war deren prominentestes Projekt und langjähriger Spender der Zig Software Foundation. Sein Kernargument: Bun musste nicht zwischen Style-Guides in Zig und Compiler-erzwungenem Ownership in Rust wählen — die fehlende Zutat war Disziplin, nicht der Borrow-Checker. Das Zig-Team sei über die Praktiken in Buns Codebase schon vor der Übernahme entsetzt gewesen.",
    g: "Einordnung: Der persönliche Ton seines Posts (Angriffe auf Sumner) hat viele seiner validen technischen Punkte in der Debatte diskreditiert — beides sollte man trennen.",
  },
  {
    icon: "git-pull-request",
    title: "Nicht reviewbar",
    sub: "Über 1 Mio. Zeilen in einem PR — kein Mensch hat die Codebase vollständig gelesen.",
    h: "Niemand hat den Code gelesen",
    t: "Der Merge-PR umfasste über 1 Mio. Zeilen; GitHub flaggte den Folge-PR (minus 600.000 Zeilen Zig) automatisch als AI slop und schloss ihn. Die Korrektheits-Orakel waren Compiler, Testsuite (über 1 Mio. Assertions) und adversarielle Claude-Reviews — kein Mensch. Risiko: Wartung ohne mentales Modell; Tests spezifizieren nur, was jemand einmal getestet hat.",
    g: "Gegenposition (Simon Willison): Genau der Weg von diesem Rohzustand zu etwas Produktionsreifem ist die eigentliche Leistung — Rohzustand und Endzustand nicht verwechseln.",
  },
  {
    icon: "scale",
    title: "Interessenkonflikt",
    sub: "Anthropic besitzt Bun, stellt das Modell und verkauft die Tokens — der Rewrite ist auch Marketing.",
    h: "Wer hier wem die Rechnung stellt",
    t: "Anthropic kaufte Bun im Dezember 2025, stellte Modell und Tokens und profitiert von der Story. Die 165.000 $ (≈ 145.000 €) sind Listenpreis — faktisch eine Rechnung an sich selbst. Mitchell Hashimotos Einordnung als „incredible deal“ ignoriert diesen Umstand.",
    g: "Einordnung: Das entwertet die technische Leistung nicht, verlangt aber unabhängige Verifikation — Testsuite und Canary-Builds sind öffentlich prüfbar.",
  },
];

const idx = ref<number | null>(null);
</script>

<template>
  <div class="bun-critique">
    <div class="bun-sub">Karte anklicken für Zahlen und Gegenposition</div>

    <div class="bun-card-grid">
      <div
        v-for="(c, i) in cards"
        :key="c.title"
        class="bun-card"
        @click="idx = i"
      >
        <div class="bun-card-head">
          <BunIcon :name="c.icon" :size="16" :class="{ 'bun-warn': c.warn }" />
          <span class="bun-card-title">{{ c.title }}</span>
          <BunIcon name="info-circle" :size="13" class="bun-card-info" />
        </div>
        <div class="bun-card-sub">{{ c.sub }}</div>
      </div>
    </div>

    <div class="bun-footer">
      Gegenposition insgesamt: 100 % Test-Pass auf allen Plattformen · Binary
      3–8 MB kleiner · Miri-CI nachgerüstet · seit Mitte Mai in Produktion
    </div>

    <BunPopover :open="idx !== null" @close="idx = null">
      <template v-if="idx !== null">
        <div class="bun-pop-h">{{ cards[idx].h }}</div>
        <div class="bun-pop-t">{{ cards[idx].t }}</div>
        <div class="bun-pop-t bun-pop-sep">{{ cards[idx].g }}</div>
      </template>
    </BunPopover>
  </div>
</template>

<style scoped>
.bun-critique {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 4px;
}
.bun-sub {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.bun-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.bun-card {
  padding: 12px 14px;
  background: var(--color-background-secondary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 10px;
  cursor: pointer;
}
.bun-card:hover {
  border-color: var(--color-border-secondary);
}
.bun-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bun-warn {
  color: var(--color-text-warning);
}
.bun-card-title {
  font-size: 13px;
  font-weight: 500;
}
.bun-card-info {
  margin-left: auto;
  color: var(--color-text-tertiary);
}
.bun-card-sub {
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}
.bun-footer {
  margin-top: auto;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
</style>
