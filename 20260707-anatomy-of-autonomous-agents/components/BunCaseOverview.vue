<script setup lang="ts">
import { ref } from "vue";
import BunIcon from "./BunIcon.vue";
import BunPopover from "./BunPopover.vue";

// Bonus-Slide 1: Kennzahlen, Agentenrollen und Makro-Zeitleiste des
// Bun-Rewrites (Zig → Rust). Inhalte aus den Quellen (bun.com-Blogpost,
// Pragmatic Engineer 16.07.2026, andrewkelley.me); Kosten in Euro,
// nachgerechnet zu Fable-5-Listenpreisen (siehe Kennzahlen-Popup).
const pop = ref<null | "zahlen" | "rollen" | "kelley">(null);

const metrics = [
  { label: "Dauer", value: "11 Tage" },
  { label: "Zeilen Zig → Rust", value: "535k → 1 Mio+" },
  { label: "Dateien", value: "1.448" },
  { label: "Commits", value: "6.502" },
  { label: "API-Kosten (Liste)", value: "≈ 145.000 €" },
];

const roles = [
  { icon: "code", title: "Porter", sub: "Peak 64 parallel (4 Worktrees × 16)" },
  {
    icon: "eye",
    title: "Adversarielle Reviewer",
    sub: "2 pro Commit, separate Sessions",
  },
  { icon: "tool", title: "Fixer", sub: "1 pro Crate, setzt Befunde um" },
  {
    icon: "refresh",
    title: "Meta-Workflows",
    sub: "~50 Workflows steuern das Ganze",
  },
];

const timeline = [
  { date: "Dez 2025", label: "Anthropic übernimmt Bun" },
  { date: "Anf. Mai 2026", label: "11-Tage-Rewrite" },
  { date: "14. Mai", label: "Merge in main" },
  { date: "21. Mai", label: "Unsafe-Audit" },
  { date: "8. Jul", label: "Blogpost erscheint" },
  { date: "9. Jul", label: "Zig-Schöpfer antwortet", pop: "kelley" as const },
];
</script>

<template>
  <div class="bun-overview">
    <div>
      <div class="bun-slab">
        Kennzahlen
        <button
          class="bun-ib"
          aria-label="Hinweise zu den Kennzahlen"
          @click="pop = 'zahlen'"
        >
          <BunIcon name="info-circle" :size="14" />
        </button>
      </div>
      <div class="bun-metric-grid">
        <div v-for="m in metrics" :key="m.label" class="bun-mc">
          <div class="bun-mc-label">{{ m.label }}</div>
          <div class="bun-mc-value">{{ m.value }}</div>
        </div>
      </div>
    </div>

    <div>
      <div class="bun-slab">
        Agentenrollen
        <button
          class="bun-ib"
          aria-label="Hinweise zu den Agentenrollen"
          @click="pop = 'rollen'"
        >
          <BunIcon name="info-circle" :size="14" />
        </button>
      </div>
      <div class="bun-role-grid">
        <div v-for="r in roles" :key="r.title" class="bun-rc">
          <div class="bun-rc-title">
            <BunIcon :name="r.icon" :size="14" />
            {{ r.title }}
          </div>
          <div class="bun-rc-sub">{{ r.sub }}</div>
        </div>
      </div>
    </div>

    <div>
      <div class="bun-slab bun-slab-timeline">Makro-Zeitleiste</div>
      <div class="bun-tl">
        <div
          v-for="(t, i) in timeline"
          :key="t.date"
          class="bun-tl-item"
          :class="{ 'bun-tl-clickable': t.pop }"
          @click="t.pop && (pop = t.pop)"
        >
          <div class="bun-tl-date">{{ t.date }}</div>
          <div class="bun-tl-track">
            <div class="bun-tl-line" :class="{ 'bun-tl-hidden': i === 0 }" />
            <div class="bun-tl-dot" />
            <div
              class="bun-tl-line"
              :class="{ 'bun-tl-hidden': i === timeline.length - 1 }"
            />
          </div>
          <div class="bun-tl-label">
            {{ t.label }}
            <BunIcon
              v-if="t.pop"
              name="info-circle"
              :size="12"
              class="bun-tl-info"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="bun-sources">
      Quellen: bun.com/blog/bun-in-rust · The Pragmatic Engineer (16. Jul 2026)
      · andrewkelley.me
    </div>

    <BunPopover :open="pop !== null" @close="pop = null">
      <template v-if="pop === 'zahlen'">
        <div class="bun-pop-h">Hinweise zu den Kennzahlen</div>
        <div class="bun-pop-t">
          Der API-Listenpreis lag bei 165.000 $ — Anthropic besitzt Bun seit
          Dezember 2025 und stellte die Rechnung faktisch an sich selbst. Die 11
          Tage zählen von der Planung bis zum verifizierten Merge. Aus 535.496
          Zeilen Zig wurden über 1 Mio. Zeilen Rust: Rust ist hier
          ausführlicher, das Projekt wurde nicht größer.
        </div>
        <div class="bun-pop-t">
          <strong>Nachgerechnet</strong> — belegt sind die Token-Zahlen, nicht
          der Preis: 5,9 Mrd. uncached Input × 10 $ + 690 Mio. Output × 50 $ +
          72 Mrd. Cache-Reads × 1 $ (je MTok, Fable-5-Listenpreise) = 165.500 $
          ≈ 145.000 € (EZB-Kurs 0,875 · 17.07.2026). Cache-<em>Writes</em>
          (Aufpreis 1,25×) sind nicht ausgewiesen, der Preis ist also eher eine
          Untergrenze. Ohne Caching hätten die 72 Mrd. Reads allein 720.000 $
          gekostet — das Caching sparte ~650.000 $.
        </div>
        <div class="bun-pop-meta">
          Warum Output 5× Input kostet →
          <TalkXref slug="20260408-agents-details" anchor="token-oekonomie"
            >Token-Ökonomie</TalkXref
          >
          · Cache-Reads für 0,1× →
          <TalkXref slug="20260408-agents-details" anchor="caching"
            >Caching</TalkXref
          >
        </div>
      </template>
      <template v-else-if="pop === 'rollen'">
        <div class="bun-pop-h">64 ist nicht die Teamgröße</div>
        <div class="bun-pop-t">
          64 war die Peak-Parallelität (4 Worktrees × je 16 Claudes), nicht die
          Anzahl der Agenten insgesamt. Die eigentliche Organisationseinheit
          waren rund 50 dynamische Claude-Code-Workflows über die 11 Tage. Jeder
          Commit musste 2 adversarielle Reviews passieren — ein menschliches
          Code-Review gab es nicht. Modell: Pre-Release von Claude Fable 5.
        </div>
      </template>
      <template v-else-if="pop === 'kelley'">
        <div class="bun-pop-h">Wer antwortet hier?</div>
        <div class="bun-pop-t">
          Andrew Kelley ist Schöpfer und Projektleiter der Programmiersprache
          Zig, in der Bun ursprünglich geschrieben war. Bun war das
          prominenteste Zig-Projekt und lange regelmäßiger Spender der Zig
          Software Foundation. Am 9. Juli 2026 antwortete Kelley mit dem
          Blogpost „My Thoughts on the Bun Rust Rewrite“: Buns
          Stabilitätsprobleme lägen an mangelnder Engineering-Disziplin, nicht
          an Zig — den KI-generierten Port nennt er „unreviewed slop“.
        </div>
      </template>
    </BunPopover>
  </div>
</template>

<style scoped>
.bun-overview {
  display: flex;
  flex-direction: column;
  gap: 13px;
  margin-top: 8px;
}
.bun-slab {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}
.bun-slab-timeline {
  margin-bottom: 8px;
}
.bun-ib {
  padding: 0 2px;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  line-height: 1;
  vertical-align: -1px;
}
.bun-ib:hover {
  color: var(--color-text-primary);
}

.bun-metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.bun-mc {
  padding: 6px 10px;
  background: var(--color-background-secondary);
  border-radius: var(--sk-radm);
}
.bun-mc-label {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.bun-mc-value {
  font-size: 16px;
  font-weight: 500;
}

.bun-role-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.bun-rc {
  padding: 7px 10px;
  background: var(--color-background-secondary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 10px;
}
.bun-rc-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
}
.bun-rc-sub {
  margin-top: 2px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.bun-tl {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
}
.bun-tl-item {
  text-align: center;
}
.bun-tl-clickable {
  cursor: pointer;
}
.bun-tl-date {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.bun-tl-track {
  display: flex;
  align-items: center;
  margin: 3px 0;
}
.bun-tl-line {
  flex: 1;
  height: 1px;
  background: var(--color-border-secondary);
}
.bun-tl-hidden {
  background: transparent;
}
.bun-tl-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-secondary);
}
.bun-tl-label {
  font-size: 11px;
  line-height: 1.35;
}
.bun-tl-info {
  color: var(--color-text-tertiary);
}

.bun-sources {
  margin-top: auto;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
</style>
