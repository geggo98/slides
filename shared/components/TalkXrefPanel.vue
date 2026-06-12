<script setup lang="ts">
import TalkXref from "@shared/components/TalkXref.vue";
import { TALKS, type TalkSlug } from "@shared/talks";

// Datengetriebenes Querverweis-Panel: konsolidiert die ehemals ~80 % identischen
// Zwei-Spalten-Panels JspecifyCrossRef (open-rewrite) und DesignPatternCrossRef
// (design-pattern). Links die "Dieser Talk"-Spalte, rechts ein oder mehrere
// "Querverweis"-Blöcke mit TalkXref-Link (optional mit anchor-Deeplink auf ein
// routeAlias im Ziel-Deck, siehe talkUrl in @shared/talks).
//
// Bullets (und hint) sind HTML-Strings und werden per v-html gerendert — die
// Original-Panels nutzen Inline-Markup wie <code>/<strong>/<em>, das über Props
// nur so verlustfrei transportierbar ist. Der Inhalt ist repo-kontrolliert
// (steht in slides.md bzw. Deck-Komponenten, nie User-Input), darum ist v-html
// hier sicher; eslint-Regel vue/no-v-html ist in diesem Repo aus genau diesem
// Grund deaktiviert. Scoped-CSS erreicht v-html-Inhalt nicht, daher :deep(code).
//
// variant steuert die exakte Optik der beiden Ursprungs-Panels:
//   - "info" (Default, ex JspecifyCrossRef): here-Spalte info-getönt,
//     invertierte Badges, 1fr/1fr-Grid, 13px-Bullets.
//   - "neutral" (ex DesignPatternCrossRef): beide Spalten neutral, getönte
//     Badges mit Border (alt = warning), 1fr/1.15fr-Grid (breitere
//     Querverweis-Spalte für mehrere Refs), 12.5px-Bullets.

interface XrefHere {
  title: string;
  bullets: string[]; // HTML erlaubt
}

interface XrefRef {
  slug: TalkSlug;
  title?: string; // Fallback: Kurztitel aus TALKS
  bullets: string[]; // HTML erlaubt
  anchor?: string | number; // routeAlias (bevorzugt) oder Folien-Nummer
  hint?: string; // kursiver Hinweistext unter den Bullets, HTML erlaubt
}

withDefaults(
  defineProps<{
    here: XrefHere;
    refs: XrefRef[];
    variant?: "info" | "neutral";
  }>(),
  { variant: "info" },
);

// Linktext: expliziter title, sonst Registry-Kurztitel; Runtime-Guard für
// Markdown-Verwendungen, die vue-tsc nicht prüft (analog TalkXref).
const refTitle = (r: XrefRef): string =>
  r.title ?? (r.slug in TALKS ? TALKS[r.slug] : r.slug);
</script>

<template>
  <div class="xref-grid" :class="variant">
    <div class="col here">
      <header>
        <span class="badge">Dieser Talk</span>
        {{ here.title }}
      </header>
      <ul>
        <li v-for="(bullet, i) in here.bullets" :key="i" v-html="bullet" />
      </ul>
    </div>
    <div class="col there">
      <template v-for="(r, i) in refs" :key="i">
        <header :class="{ mt: i > 0 }">
          <span class="badge alt">Querverweis</span>
          <TalkXref :slug="r.slug" :anchor="r.anchor">{{
            refTitle(r)
          }}</TalkXref>
        </header>
        <ul>
          <li v-for="(bullet, j) in r.bullets" :key="j" v-html="bullet" />
        </ul>
        <p v-if="r.hint" class="hint" v-html="r.hint" />
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ---- Variante "info" (Default) — exakt die Optik von JspecifyCrossRef ---- */
.xref-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: var(--sk-rad);
  border: 0.5px solid var(--color-border-tertiary);
}
.col.here {
  background: var(--color-background-info);
  border-color: var(--color-border-info);
}
.col.there {
  background: var(--color-background-secondary);
}
header {
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 10px;
}
/* Folge-Querverweise im selben Panel: etwas Luft zusätzlich zum Flex-Gap. */
header.mt {
  margin-top: 6px;
}
.badge {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--color-text-info);
  color: var(--color-background-info);
  padding: 2px 8px;
  border-radius: 4px;
}
.badge.alt {
  background: var(--color-text-secondary);
  color: var(--color-background-secondary);
}
ul {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 13px;
  line-height: 1.7;
}
li {
  margin: 0.2rem 0;
}
/* :deep, weil <code> aus v-html-Bullets kommt und kein Scope-Attribut trägt. */
.col :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--color-background-primary);
  padding: 1px 5px;
  border-radius: 3px;
}
.hint {
  font-size: 11.5px;
  color: var(--color-text-tertiary);
  margin: 6px 0 0;
  font-style: italic;
  line-height: 1.55;
}

/* ---- Variante "neutral" — exakt die Optik von DesignPatternCrossRef ---- */
.xref-grid.neutral {
  grid-template-columns: 1fr 1.15fr;
  font-family: var(--font-sans);
}
.neutral .col {
  display: block;
  padding: 12px 16px;
  border-radius: var(--sk-radm);
  background: var(--color-background-secondary);
}
.neutral .col.here {
  border-color: var(--color-border-tertiary);
}
.neutral header {
  display: block;
  font-weight: 600;
  font-size: 15px;
  color: var(--color-text-primary);
  margin-bottom: 8px;
  line-height: 1.3;
}
.neutral header.mt {
  margin-top: 14px;
}
.neutral .badge {
  display: inline-block;
  font-weight: 600;
  padding: 2px 7px;
  margin-right: 8px;
  background: var(--color-background-info);
  color: var(--color-text-info);
  border: 0.5px solid var(--color-border-info);
}
.neutral .badge.alt {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
  border-color: var(--color-border-warning);
}
.neutral ul {
  padding-left: 18px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}
.neutral li {
  margin: 0 0 4px;
}
</style>
