<script setup lang="ts">
import BunPopover from "./BunPopover.vue";

// Generisches ⓘ-Quellen-Modal — extrahiert aus `ModelRoutingSources.vue`, das
// bis hierher Template UND die vier Modell-Routing-Datensätze in einer Datei
// trug. `HarnessTaxSources.vue` braucht dieselbe Optik für einen komplett
// anderen Datensatz (andere Studie, andere Einschränkungen); statt die ~90
// Zeilen Markup+CSS ein zweites Mal abzuschreiben, bekommt jeder Host jetzt
// nur noch seine eigenen Daten, das Modal selbst liegt hier einmal.
interface Source {
  href: string;
  label: string;
  note: string;
}
interface Caveat {
  lead: string;
  text: string;
}

defineProps<{
  open: boolean;
  /** Geltungsbereich-Satz über der zweispaltigen Liste — jedes Modal hängt an
   * mindestens einer, oft mehreren Folien; hier steht, an welchen. */
  scope: string;
  sources: readonly Source[];
  caveats: readonly Caveat[];
}>();
const emit = defineEmits<{ (e: "close"): void }>();
</script>

<template>
  <BunPopover :open="open" wide @close="emit('close')">
    <div class="bun-pop-h">Quellen &amp; Einschränkungen</div>
    <div class="mrs-scope">{{ scope }}</div>
    <div class="mrs-grid">
      <div>
        <div class="mrs-col-h">Quellen</div>
        <ul class="mrs-list">
          <li v-for="s in sources" :key="s.href">
            <a :href="s.href" target="_blank" rel="noopener">{{ s.label }}</a>
            <span class="mrs-note"> — {{ s.note }}</span>
          </li>
        </ul>
      </div>
      <div>
        <div class="mrs-col-h">Einschränkungen</div>
        <ul class="mrs-list">
          <li v-for="c in caveats" :key="c.lead">
            <strong>{{ c.lead }}</strong> {{ c.text }}
          </li>
        </ul>
      </div>
    </div>
  </BunPopover>
</template>

<style scoped>
.mrs-scope {
  margin: -2px 0 10px;
  font-size: 10.5px;
  color: var(--color-text-tertiary);
}
.mrs-grid {
  display: grid;
  grid-template-columns: 1fr 1.25fr;
  gap: 22px;
}
.mrs-col-h {
  margin-bottom: 6px;
  padding-bottom: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  border-bottom: 0.5px solid var(--color-border-tertiary);
}
.mrs-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  list-style: none;
}
.mrs-list li {
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-text-primary);
}
.mrs-list a {
  color: var(--slidev-theme-primary);
  text-decoration: none;
}
.mrs-list a:hover {
  text-decoration: underline;
}
.mrs-note {
  color: var(--color-text-tertiary);
  font-size: 10.5px;
}
</style>
