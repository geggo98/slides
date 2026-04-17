<script setup>
import { ref, computed } from "vue";

const rows = [
  "JAVA_HOME",
  "daemon-jvm.properties",
  "toolchain { }",
  "options.release",
  "sourceCompatibility",
  "targetCompatibility",
  "javaLauncher (Task)",
  "Multi-Release JAR",
  "--enable-preview",
];

const cols = ["Daemon", "Toolchain", "Source", "Target", "Bytecode", "Runtime"];

const SYMBOL = { primary: "●", override: "◆", indirect: "○", none: "·" };

// Grid layout: [row][col] → kind
const grid = [
  ["primary", "indirect", "none", "none", "none", "none"],
  ["primary", "none", "none", "none", "none", "none"],
  ["none", "primary", "indirect", "indirect", "indirect", "indirect"],
  ["none", "none", "override", "override", "primary", "primary"],
  ["none", "none", "primary", "none", "none", "none"],
  ["none", "none", "none", "primary", "primary", "primary"],
  ["none", "override", "none", "none", "none", "override"],
  ["none", "none", "none", "none", "indirect", "indirect"],
  ["none", "none", "indirect", "none", "indirect", "override"],
];

const interactions = {
  "0-0": {
    source: "JAVA_HOME / org.gradle.java.home",
    target: "Daemon-JVM",
    kind: "primary",
    kindLabel: "setzt direkt",
    body: "Der Legacy-Weg, das JDK des Gradle-Daemons zu bestimmen. Auflösungsreihenfolge: CLI <code>-Dorg.gradle.java.home</code>, dann <code>org.gradle.java.home</code> in <code>gradle.properties</code>, dann <code>JAVA_HOME</code>, dann <code>java</code> im <code>PATH</code>. Seit Gradle 9.2 durch <code>gradle-daemon-jvm.properties</code> als bevorzugter Weg abgelöst.",
  },
  "0-1": {
    source: "JAVA_HOME",
    target: "Toolchain",
    kind: "indirect",
    kindLabel: "indirekte Seitenwirkung",
    body: "Nur als Fallback: Wenn keine Toolchain konfiguriert ist, kompiliert Gradle mit der Daemon-JVM — also effektiv mit dem durch <code>JAVA_HOME</code> gewählten JDK. Das ist genau die Quelle nicht-reproduzierbarer Builds zwischen Entwickler-Maschinen.",
  },
  "1-0": {
    source: "gradle-daemon-jvm.properties",
    target: "Daemon-JVM",
    kind: "primary",
    kindLabel: "setzt direkt",
    body: "Der moderne Weg, stabil seit Gradle 9.2. Höchste Priorität vor <code>org.gradle.java.home</code> und <code>JAVA_HOME</code>. Entscheidender Vorteil: CLI und IDE (IntelliJ, VS Code) teilen sich denselben Daemon — keine parallelen Daemons mehr wegen divergenter <code>JAVA_HOME</code>-Werte. Wird per <code>./gradlew updateDaemonJvm</code> angelegt.",
  },
  "2-1": {
    source: "toolchain { languageVersion }",
    target: "Toolchain",
    kind: "primary",
    kindLabel: "setzt direkt",
    body: "Der moderne, idiomatische Weg seit Gradle 6.7. Definiert das JDK für <code>compileJava</code>, <code>test</code>, <code>javadoc</code>, <code>run</code> und <code>bootRun</code>. Foojay-Resolver lädt es bei Bedarf herunter. Vendor-Präferenz optional via <code>vendor = JvmVendorSpec.ADOPTIUM</code>.",
  },
  "2-2": {
    source: "toolchain { }",
    target: "sourceCompatibility",
    kind: "indirect",
    kindLabel: "indirekte Seitenwirkung",
    body: "Setzt <code>sourceCompatibility</code> implizit auf die Toolchain-Version, falls nicht anderweitig überschrieben. Wenn Toolchain 21 gesetzt wird, ist <code>sourceCompatibility = VERSION_21</code> der Default.",
  },
  "2-3": {
    source: "toolchain { }",
    target: "targetCompatibility",
    kind: "indirect",
    kindLabel: "indirekte Seitenwirkung",
    body: "Analog zu Source: <code>targetCompatibility</code> wird implizit auf die Toolchain-Version gesetzt. Ohne weitere Konfiguration emittiert der Build Bytecode für exakt diese Version.",
  },
  "2-4": {
    source: "toolchain { }",
    target: "Bytecode-Version",
    kind: "indirect",
    kindLabel: "indirekte Seitenwirkung",
    body: "Folgt aus <code>targetCompatibility</code>: Classfile-Major = 44 + Toolchain-Version. Toolchain 21 → Major 65. Toolchain 17 → Major 61.",
  },
  "2-5": {
    source: "toolchain { }",
    target: "Runtime-Minimum",
    kind: "indirect",
    kindLabel: "indirekte Seitenwirkung",
    body: "Folgt aus der Bytecode-Version, die wiederum aus target folgt. Toolchain 21 ohne <code>options.release</code> = Artefakt läuft nur auf JRE 21 oder höher.",
  },
  "3-2": {
    source: "options.release",
    target: "sourceCompatibility",
    kind: "override",
    kindLabel: "überschreibt im Konflikt",
    body: "Wenn gesetzt, gewinnt <code>options.release</code> gegen <code>sourceCompatibility</code>. Gradle versucht nicht einmal, einen Konflikt zu melden — <code>sourceCompatibility</code> wird schlicht ignoriert, sobald <code>options.release</code> existiert.",
  },
  "3-3": {
    source: "options.release",
    target: "targetCompatibility",
    kind: "override",
    kindLabel: "überschreibt im Konflikt",
    body: "Analog: <code>targetCompatibility</code> wird ignoriert, sobald <code>options.release</code> gesetzt ist. Beide parallel zu setzen ist Legacy-Aberglaube und führt zu schwer zu debuggenden Missverständnissen im Team.",
  },
  "3-4": {
    source: "options.release",
    target: "Bytecode-Version",
    kind: "primary",
    kindLabel: "setzt direkt",
    body: "Setzt die Classfile-Major-Version. <strong>Zusätzlich</strong> bindet <code>--release N</code> die API-Sicht an das Ziel-JDK via <code>$JAVA_HOME/lib/ct.sym</code> — der entscheidende Sicherheitsmechanismus, der <code>sourceCompatibility</code>/<code>targetCompatibility</code> fehlt. JEP 247, seit JDK 9.",
  },
  "3-5": {
    source: "options.release",
    target: "Runtime-Minimum",
    kind: "primary",
    kindLabel: "setzt direkt",
    body: "Setzt das Runtime-Minimum explizit auf N. Im Gegensatz zu <code>targetCompatibility</code> scheitert der Build bereits beim Kompilieren, wenn der Code APIs aus einer höheren Version nutzt.",
  },
  "4-2": {
    source: "sourceCompatibility",
    target: "sourceCompatibility",
    kind: "primary",
    kindLabel: "setzt direkt",
    body: 'Der klassische, legacy Setter für das Source Level. Entspricht dem javac-Flag <code>-source N</code>. Setzt lediglich, welche Sprachfeatures akzeptiert werden — schränkt <em>nicht</em> die sichtbare JDK-API ein. Wird von <code>options.release</code> überschrieben, wenn beide gesetzt sind. Laut Gradle-Userguide „legacy mechanism, not generally advised"; Deprecation für Gradle 10 geplant.',
  },
  "5-3": {
    source: "targetCompatibility",
    target: "targetCompatibility",
    kind: "primary",
    kindLabel: "setzt direkt",
    body: "Legacy Setter für das Target Level. Entspricht <code>javac -target N</code>.",
  },
  "5-4": {
    source: "targetCompatibility",
    target: "Bytecode-Version",
    kind: "primary",
    kindLabel: "setzt direkt",
    body: "Bestimmt die Classfile-Major-Version direkt: Classfile 65 = Java 21, 61 = Java 17, 55 = Java 11, 52 = Java 8.",
  },
  "5-5": {
    source: "targetCompatibility",
    target: "Runtime-Minimum",
    kind: "primary",
    kindLabel: "setzt direkt",
    body: "Setzt die minimale Runtime-JVM — aber <em>ohne</em> Begrenzung der beim Kompilieren sichtbaren API. Genau das ist der Morling-Bug: Build-JDK 21 mit <code>targetCompatibility = 8</code> erzeugt Classfile 52, aber mit Java-21-API-Aufrufen. <code>NoSuchMethodError</code> garantiert.",
  },
  "6-1": {
    source: "javaLauncher auf Task",
    target: "Toolchain",
    kind: "override",
    kindLabel: "überschreibt im Konflikt",
    body: "Per-Task-Override. Ein einzelner <code>Test</code>- oder <code>JavaExec</code>-Task kann eine abweichende JVM nutzen, ohne die projektweite Toolchain zu ändern. Klassischer Anwendungsfall: Multi-JDK-Testing, bei dem dieselben Classfiles gegen JDK 17, 21 und 25 getestet werden.",
  },
  "6-5": {
    source: "javaLauncher auf Task",
    target: "Runtime-Minimum",
    kind: "override",
    kindLabel: "überschreibt im Konflikt",
    body: "Task-lokale Runtime-JVM. Gilt nur für diesen Task, nicht für produzierte Artefakte. Für das JAR bleibt das globale Runtime-Minimum maßgeblich.",
  },
  "7-4": {
    source: "Multi-Release JAR",
    target: "Bytecode-Version",
    kind: "indirect",
    kindLabel: "indirekte Seitenwirkung",
    body: "Pro JDK-Major-Version eine Override-Class in <code>META-INF/versions/N/</code>. Classloader ab JRE 9 wählen automatisch die höchste passende Variante; ältere JREs sehen nur den Root. JEP 238.",
  },
  "7-5": {
    source: "Multi-Release JAR",
    target: "Runtime-Minimum",
    kind: "indirect",
    kindLabel: "indirekte Seitenwirkung",
    body: "Das Minimum wird vom Root-Target bestimmt (weil es auf allen JVMs ladbar sein muss). Die Overrides sind ein Bonus für neuere JREs — nicht eine Anhebung des Minimums.",
  },
  "8-2": {
    source: "--enable-preview",
    target: "sourceCompatibility",
    kind: "indirect",
    kindLabel: "indirekte Seitenwirkung",
    body: "Aktiviert Preview-Sprachfeatures der aktuellen JDK-Version — String Templates, Structured Concurrency, Scoped Values je nach JDK.",
  },
  "8-4": {
    source: "--enable-preview",
    target: "Bytecode-Version",
    kind: "indirect",
    kindLabel: "indirekte Seitenwirkung",
    body: "Classfiles erhalten <code>minor_version = 65535</code>. Das bindet die Class an <em>exakt</em> eine JDK-Major-Version — kein Forward-Kompatibilität, kein Backport.",
  },
  "8-5": {
    source: "--enable-preview",
    target: "Runtime-Minimum",
    kind: "override",
    kindLabel: "überschreibt im Konflikt",
    body: "Hebt das normale Runtime-Modell aus den Angeln: Das Artefakt läuft <strong>nur</strong> auf der exakt passenden JDK-Major-Version <strong>und</strong> nur wenn die JVM beim Start <code>--enable-preview</code> bekommt. Preview-Classes lassen sich nicht auf späteren JDKs ausführen, auch nicht mit <code>--enable-preview</code>.",
  },
};

const selectedKey = ref("2-1");
const selected = computed(() => interactions[selectedKey.value]);

function cellKey(r, c) {
  return `${r}-${c}`;
}
function onCell(r, c) {
  const kind = grid[r][c];
  if (kind === "none") return;
  selectedKey.value = cellKey(r, c);
}
</script>

<template>
  <div class="mx-section">
    <div class="mx-header">
      <p class="mx-intro">
        Interaktionen zwischen Konfigurationsquellen (Zeilen) und abgeleiteten
        Werten (Spalten).
      </p>
      <div class="mx-legend">
        <span class="mx-legend-item"
          ><span class="mx-dot primary">●</span>setzt direkt</span
        >
        <span class="mx-legend-item"
          ><span class="mx-dot override">◆</span>überschreibt</span
        >
        <span class="mx-legend-item"
          ><span class="mx-dot indirect">○</span>indirekt</span
        >
      </div>
    </div>

    <div class="mx-wrapper">
      <div class="mx-grid">
        <div class="mx-corner">Quelle ↓ / Ziel →</div>
        <div v-for="col in cols" :key="col" class="mx-head">{{ col }}</div>

        <template v-for="(row, r) in rows" :key="row">
          <div class="mx-row-label">{{ row }}</div>
          <button
            v-for="(_, c) in cols"
            :key="cellKey(r, c)"
            type="button"
            class="mx-cell"
            :class="[grid[r][c], { selected: selectedKey === cellKey(r, c) }]"
            :disabled="grid[r][c] === 'none'"
            @click.stop="onCell(r, c)"
          >
            {{ SYMBOL[grid[r][c]] }}
          </button>
        </template>
      </div>
    </div>

    <div class="mx-panel">
      <div class="mx-panel-header">
        <span class="mx-panel-flow">
          <code>{{ selected.source }}</code>
          <span class="arrow">→</span>
          {{ selected.target }}
        </span>
        <span class="mx-panel-kind" :class="selected.kind">{{
          selected.kindLabel
        }}</span>
      </div>
      <p class="mx-panel-body" v-html="selected.body" />
    </div>
  </div>
</template>

<style scoped>
.mx-section {
  margin: 0;
}
.mx-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin: 0 0 0.4rem;
}
.mx-intro {
  font-size: 11.5px;
  color: var(--color-text-secondary);
  line-height: 1.45;
  margin: 0;
  flex: 1 1 320px;
}

.mx-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 11px;
  color: var(--color-text-secondary);
  align-items: center;
}
.mx-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.mx-dot {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 500;
}
.mx-dot.primary {
  background: var(--color-background-success);
  color: var(--color-text-success);
}
.mx-dot.override {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
}
.mx-dot.indirect {
  background: var(--color-background-secondary);
  color: var(--color-text-tertiary);
}

.mx-wrapper {
  overflow-x: auto;
  padding-bottom: 2px;
  margin-bottom: 0.5rem;
}
.mx-grid {
  display: grid;
  grid-template-columns: 160px repeat(6, minmax(58px, 1fr));
  gap: 2px;
  min-width: 540px;
}
.mx-corner {
  font-size: 9.5px;
  color: var(--color-text-tertiary);
  padding: 4px 8px 4px 0;
  text-align: right;
  line-height: 1.25;
  align-self: end;
}
.mx-head {
  padding: 4px 4px;
  font-size: 10px;
  font-weight: 500;
  color: var(--color-text-primary);
  background: var(--color-background-secondary);
  border-radius: var(--border-radius-md);
  text-align: center;
  font-family: var(--font-mono);
}
.mx-row-label {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--color-text-primary);
  padding: 0 8px 0 0;
  text-align: right;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  line-height: 1.25;
  word-break: break-word;
}

.mx-cell {
  height: 22px;
  border: 0.5px solid transparent;
  border-radius: var(--border-radius-md);
  background: var(--color-background-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  padding: 0;
  transition: border-color 0.15s;
}
.mx-cell:hover:not(:disabled) {
  border-color: var(--color-border-primary);
}
.mx-cell.selected {
  border: 1px solid var(--color-border-primary);
}
.mx-cell.primary {
  background: var(--color-background-success);
  color: var(--color-text-success);
}
.mx-cell.override {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
}
.mx-cell.indirect {
  background: var(--color-background-secondary);
  color: var(--color-text-tertiary);
}
.mx-cell.none {
  background: transparent;
  color: var(--color-text-tertiary);
  opacity: 0.35;
  font-size: 10px;
  cursor: default;
}

.mx-panel {
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-lg);
  padding: 0.45rem 0.75rem;
}
.mx-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 3px;
}
.mx-panel-flow {
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-weight: 500;
  color: var(--color-text-primary);
}
.mx-panel-flow :deep(code),
.mx-panel-flow code {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 4px;
  background: var(--color-background-secondary);
  border-radius: 4px;
}
.mx-panel-flow .arrow {
  color: var(--color-text-tertiary);
  margin: 0 4px;
}
.mx-panel-kind {
  font-size: 9.5px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 999px;
}
.mx-panel-kind.primary {
  background: var(--color-background-success);
  color: var(--color-text-success);
}
.mx-panel-kind.override {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
}
.mx-panel-kind.indirect {
  background: var(--color-background-secondary);
  color: var(--color-text-secondary);
}
.mx-panel-body {
  font-size: 11px;
  line-height: 1.4;
  color: var(--color-text-primary);
  margin: 0;
}
.mx-panel-body :deep(code) {
  font-family: var(--font-mono);
  font-size: 10.5px;
  padding: 1px 4px;
  background: var(--color-background-secondary);
  border-radius: 4px;
}
</style>
