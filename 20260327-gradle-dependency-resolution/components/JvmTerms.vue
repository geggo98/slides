<script setup>
import { ref, computed } from "vue";

const terms = [
  {
    name: "Client-VM",
    hint: "gradlew-Starter",
    body: "Der kurzlebige <code>gradlew</code>-Prozess, der die CLI parst und an den Daemon delegiert. Er muss nicht die Mindest-JDK-Version der aktuellen Gradle-Release erreichen — der Wrapper selbst ist bis JDK 8 abwärtskompatibel. In der Praxis irrelevant, sobald ein Daemon existiert.",
    example: "Steuerung: <code>JAVA_HOME</code>, <code>PATH</code>",
  },
  {
    name: "Daemon-JVM",
    hint: "Plugins laufen hier",
    body: "Der langlebige Gradle-Prozess, in dem Build-Skripte, Task-Graph und <strong>alle Plugins</strong> laufen. Gradle 9.x verlangt mindestens JDK 17 (Breaking Change gegenüber 8.x). Standardmäßig wird die Daemon-JVM auch zum Kompilieren verwendet, wenn keine Toolchain gesetzt ist — die Hauptursache für nicht-reproduzierbare Builds.",
    example:
      "Modern: <code>gradle/gradle-daemon-jvm.properties</code><br>Legacy: <code>org.gradle.java.home</code> in <code>gradle.properties</code>",
  },
  {
    name: "Toolchain",
    hint: "JDK für Compile/Test",
    body: "Das vollständige JDK, das Gradle für <code>compileJava</code>, <code>test</code>, <code>javadoc</code>, <code>run</code> und <code>bootRun</code> nutzt. Darf von der Daemon-JVM abweichen. Wird via Foojay-Resolver automatisch aus der Disco-API heruntergeladen, falls lokal nicht vorhanden. Der einzige Mechanismus, der das JDK gleichzeitig <em>festlegt</em> und <em>provisioniert</em>.",
    example:
      "java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }",
  },
  {
    name: "Source Level",
    hint: "Sprachfeatures",
    body: "Bestimmt welche <strong>Sprachfeatures</strong> der Compiler akzeptiert — <code>var</code>, Records, sealed classes, Pattern Matching für Switch, String Templates. Schränkt <em>nicht</em> die nutzbare API ein. Ein Projekt mit <code>-source 8</code> auf Build-JDK 21 kann immer noch <code>List.of()</code> (Java 9) und <code>Files.readString()</code> (Java 11) aufrufen — die Falle.",
    example: "javac -source 17 · sourceCompatibility = VERSION_17",
  },
  {
    name: "Target Level",
    hint: "Classfile-Version",
    body: "Bestimmt die <strong>Classfile-Major-Version</strong> des emittierten Bytecodes und damit implizit die minimale Runtime-JVM. Regel: <code>major = 44 + Java-Version</code>. Classfile 65 = Java 21, 61 = Java 17, 55 = Java 11, 52 = Java 8. Preview-Features setzen <code>minor = 65535</code> und binden die Class an exakt eine Major-Version.",
    example: "javac -target 17 · targetCompatibility = VERSION_17",
  },
  {
    name: "--release",
    hint: "Source + Target + API",
    body: "Atomische Kombination aus Source Level + Target Level + <strong>API-Surface</strong>. Letztere wird aus <code>$JAVA_HOME/lib/ct.sym</code> des Ziel-JDK gezogen — einer ZIP mit Header-only-Classfiles aller historischen JDK-Versionen. Schützt vor versehentlicher Nutzung späterer APIs beim Kompilieren. Der moderne, korrekte Weg für Cross-Compilation.",
    example: "tasks.withType&lt;JavaCompile&gt;() { options.release.set(17) }",
  },
  {
    name: "Runtime",
    hint: "JVM beim Endnutzer",
    body: "Die JVM, auf der das fertige Artefakt beim Endnutzer läuft. Wird <strong>ausschließlich</strong> von der Classfile-Major-Version bestimmt — nicht von Toolchain, Source Level oder Manifest-Einträgen. Classfile 65 auf JRE 17 wirft <code>UnsupportedClassVersionError: class file version 65.0 ... recognizes up to 61.0</code>.",
    example:
      "Multi-Release JARs (JEP 238) können pro Major-Version Override-Classes liefern.",
  },
];

const activeIdx = ref(0);
const activeTerm = computed(() => terms[activeIdx.value]);
</script>

<template>
  <div class="ig-section">
    <p class="ig-label">01 · Begriffe</p>
    <h3 class="ig-title">Sieben Konzepte, die Gradle sauber unterscheidet</h3>
    <p class="ig-intro">
      Gradle trennt <em>womit</em> gebaut wird, <em>wogegen</em> kompiliert wird
      und <em>wofür</em>
      das Artefakt läuft — drei unabhängige Achsen. Die Verwirrung in
      Legacy-Projekten kommt fast immer daher, dass diese Konzepte
      zusammengeworfen werden.
    </p>

    <div class="ig-grid-terms">
      <button
        v-for="(t, i) in terms"
        :key="t.name"
        class="ig-term"
        :class="{ active: activeIdx === i }"
        type="button"
        @click.stop="activeIdx = i"
      >
        <span class="ig-term-name">{{ t.name }}</span>
        <span class="ig-term-hint">{{ t.hint }}</span>
      </button>
    </div>

    <div class="ig-panel">
      <p class="ig-panel-title">{{ activeTerm.name }}</p>
      <p class="ig-panel-body" v-html="activeTerm.body" />
      <p class="ig-panel-example" v-html="activeTerm.example" />
    </div>
  </div>
</template>

<style scoped>
.ig-section {
  margin: 0;
}
.ig-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-tertiary);
  margin: 0 0 0.4rem;
}
.ig-title {
  font-size: 17px;
  font-weight: 500;
  margin: 0 0 0.4rem;
  color: var(--color-text-primary);
}
.ig-intro {
  font-size: 12.5px;
  color: var(--color-text-secondary);
  line-height: 1.55;
  margin: 0 0 0.8rem;
}

.ig-grid-terms {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 6px;
  margin-bottom: 10px;
}
.ig-term {
  background: var(--color-background-secondary);
  border: 0.5px solid transparent;
  border-radius: var(--border-radius-md);
  padding: 8px 10px;
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font: inherit;
  transition: border-color 0.15s;
}
.ig-term:hover {
  border-color: var(--color-border-secondary);
}
.ig-term.active {
  background: var(--color-background-primary);
  border-color: var(--color-border-primary);
}
.ig-term-name {
  font-family: var(--font-mono);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--color-text-primary);
}
.ig-term-hint {
  font-size: 10.5px;
  color: var(--color-text-secondary);
  line-height: 1.3;
}

.ig-panel {
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-lg);
  padding: 0.75rem 1rem;
}
.ig-panel-title {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 6px;
  color: var(--color-text-primary);
}
.ig-panel-body {
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--color-text-primary);
  margin: 0;
}
.ig-panel-body :deep(code) {
  font-family: var(--font-mono);
  font-size: 11.5px;
  padding: 1px 5px;
  background: var(--color-background-secondary);
  border-radius: 4px;
}
.ig-panel-example {
  font-size: 11.5px;
  font-family: var(--font-mono);
  background: var(--color-background-secondary);
  border-radius: var(--border-radius-md);
  padding: 6px 10px;
  margin: 8px 0 0;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.ig-panel-example :deep(code) {
  background: transparent;
  padding: 0;
}
</style>
