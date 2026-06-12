<script setup>
import { ref, computed } from "vue";
import Tabs from "@shared/components/Tabs.vue";

const activeTab = ref("go");
const activeEco = computed(() => ecosystems[activeTab.value]);

const tabs = [
  { key: "go", label: "Go" },
  { key: "js", label: "JavaScript" },
  { key: "py", label: "Python (uv)" },
  { key: "gradle", label: "Gradle" },
];

const ecosystems = {
  go: {
    stats: [
      { label: "Manifest + lock", value: "go.mod" },
      { label: "Checksums", value: "go.sum + sumdb" },
      { label: "Auto-lock", value: "Ja", cls: "y" },
      { label: "Lifecycle-scripts", value: "Kein Konzept", cls: "y" },
    ],
    detail:
      "<strong>Goldstandard.</strong> <code>go.mod</code> ist Manifest und Lock-File zugleich — keine Ranges, jede Dep hat exakt eine Version. Die globale Checksum Database (<code>sum.golang.org</code>) ist ein append-only Transparency Log: jeder weltweit bekommt denselben Code für eine Version. Kein Key-Management nötig.",
  },
  js: {
    stats: [
      { label: "Manifest", value: "package.json" },
      { label: "Lock-file", value: "pnpm-lock.yaml" },
      { label: "Release-cooldown", value: "pnpm built-in", cls: "y" },
      { label: "Lifecycle-scripts", value: "Hauptangriffsvektor", cls: "n" },
    ],
    detail:
      "<strong>Höchstes Angriffsrisiko.</strong> <code>npm install</code> ist effektiv Remote Code Execution via <code>postinstall</code>-Scripts. pnpm v10 deaktiviert Scripts per Default. Lock-Files enthalten SHA-512 Integrity-Hashes. pnpm führte <code>minimumReleaseAge</code> zuerst ein — npm, Bun und Yarn zogen nach; pnpm v11 aktiviert es per Default mit 1440 Minuten.",
  },
  py: {
    stats: [
      { label: "Manifest", value: "pyproject.toml" },
      { label: "Lock-file", value: "uv.lock" },
      { label: "Auto-lock", value: "Ja (uv run)", cls: "y" },
      { label: "Exclude-newer", value: "--exclude-newer", cls: "y" },
    ],
    detail:
      "<strong>Modernster Ansatz.</strong> <code>uv.lock</code> enthält Versionen und Hashes in einer Datei (Lock + Verification vereint). Cross-platform by default. <code>uv run</code> lockt automatisch. <code>--exclude-newer</code> ist ein Timestamp-Gate ähnlich <code>minimumReleaseAge</code>.",
  },
  gradle: {
    stats: [
      { label: "Manifest", value: "build.gradle.kts" },
      { label: "Lock-file", value: "gradle.lockfile" },
      { label: "Verification", value: "Separate XML" },
      { label: "Release-cooldown", value: "Nur via Tooling", cls: "n" },
    ],
    detail:
      "<strong>Mächtig, aber manuell.</strong> Gradle hat die meisten Einzelteile (Catalog, Lock, Verification, Repository Filtering, BOM), aber nichts davon ist automatisch. Lock-File braucht <code>--write-locks</code>, Verification braucht <code>--write-verification-metadata</code>. Vorteil: Kein Lifecycle-Script-Problem, starkes BOM/Platform-Konzept.",
  },
};
</script>

<template>
  <div class="eco-wrap">
    <p class="section-label">Vergleich mit anderen Ökosystemen</p>

    <Tabs v-model="activeTab" :tabs="tabs" aria-label="Ökosysteme">
      <div :key="activeTab" class="eco-card">
        <div class="eco-grid">
          <div v-for="s in activeEco.stats" :key="s.label" class="eco-stat">
            <div class="eco-stat-label">{{ s.label }}</div>
            <div class="eco-stat-value">
              <span v-if="s.cls" :class="s.cls">{{ s.value }}</span>
              <code v-else>{{ s.value }}</code>
            </div>
          </div>
        </div>
        <div class="eco-detail" v-html="activeEco.detail"></div>
      </div>
    </Tabs>
  </div>
</template>

<style scoped>
.eco-wrap {
  width: 100%;
  /* Reproduce the previous .eco-tab pill styling via the shared Tabs vars. */
  --sk-tab-font-size: 13px;
  --sk-tab-pad: 6px 14px;
  --sk-tab-radius: var(--border-radius-md);
  --sk-tab-border: 0.5px solid var(--color-border-tertiary);
  --sk-tab-transition: all 0.15s;
  --sk-tab-font-weight: 400;
  --sk-tab-active-font-weight: 500;
  --sk-tab-active-bg: var(--color-background-primary);
  --sk-tab-active-border: var(--color-border-primary);
}
.section-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 10px;
}
.eco-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 0 0 12px;
}
.eco-stat {
  background: var(--color-background-secondary);
  border-radius: var(--border-radius-md);
  padding: 10px 14px;
}
.eco-stat-label {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.eco-stat-value {
  font-size: 14px;
  font-weight: 500;
  margin-top: 2px;
}
.eco-stat-value code {
  font-family: var(--font-mono);
  font-size: 13px;
  background: var(--color-background-tertiary);
  padding: 1px 5px;
  border-radius: 4px;
}
.eco-detail {
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
.eco-detail :deep(strong) {
  color: var(--color-text-primary);
  font-weight: 500;
}
.eco-detail :deep(code) {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--color-background-tertiary);
  padding: 1px 5px;
  border-radius: 4px;
}
.y {
  color: var(--color-text-success);
  font-weight: 500;
}
.n {
  color: var(--color-text-danger);
  font-weight: 500;
}
</style>
