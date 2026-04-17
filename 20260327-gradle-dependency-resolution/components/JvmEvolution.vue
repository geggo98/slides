<script setup>
const legacyCode = `java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}`;

const modernCode = `java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}
tasks.withType<JavaCompile>().configureEach {
    options.release.set(17)
}`;
</script>

<template>
  <div class="ig-section">
    <p class="ig-label">03 · Legacy vs. 2026</p>
    <h3 class="ig-title">Die Evolution in einer Zeile</h3>
    <p class="ig-intro">
      Der identische Job — „kompiliere gegen Java 17" — in beiden Stilen:
    </p>

    <div class="ig-sidebyside">
      <div class="ig-config">
        <span class="ig-tag legacy">Legacy — vor Gradle 6.7</span>
        <p class="ig-file-header">build.gradle (Groovy)</p>
        <MonacoBlock :code="legacyCode" language="groovy" height="84px" />
        <p class="ig-config-note">
          Kompiliert mit der Daemon-JVM — jedes JDK des Entwicklers. API-Sicht
          nicht begrenzt:
          <code>String.strip()</code> oder
          <code>Files.readString()</code> fallen erst zur Laufzeit auf. Laut
          Gradle-Userguide „legacy mechanism"; Deprecation für Gradle 10
          geplant.
        </p>
      </div>

      <div class="ig-config">
        <span class="ig-tag modern">2026 — Gradle 9.x</span>
        <p class="ig-file-header">build.gradle.kts (Kotlin DSL)</p>
        <MonacoBlock :code="modernCode" language="kotlin" height="158px" />
        <p class="ig-config-note">
          Toolchain provisioniert JDK 21 via Foojay-Resolver —
          <code>JAVA_HOME</code> egal. <code>options.release = 17</code> bindet
          die API-Sicht an Java 17 via <code>ct.sym</code>. Fehler fällt beim
          Kompilieren, nicht erst in Produktion. Reproduzierbar Dev &amp; CI.
        </p>
      </div>
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
  margin: 0 0 0.3rem;
}
.ig-title {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 0.3rem;
  color: var(--color-text-primary);
}
.ig-intro {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0 0 0.5rem;
}

.ig-sidebyside {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 10px;
}
.ig-config {
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-lg);
  padding: 0.6rem 0.8rem;
  display: flex;
  flex-direction: column;
}

.ig-tag {
  display: inline-block;
  align-self: flex-start;
  font-size: 10.5px;
  font-weight: 500;
  padding: 2px 9px;
  border-radius: 999px;
  margin-bottom: 6px;
}
.ig-tag.legacy {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
}
.ig-tag.modern {
  background: var(--color-background-success);
  color: var(--color-text-success);
}

.ig-file-header {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--color-text-tertiary);
  margin: 0 0 3px;
}

.ig-config-note {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin: 6px 0 0;
  line-height: 1.45;
}
.ig-config-note :deep(code),
.ig-config-note code {
  font-family: var(--font-mono);
  font-size: 10.5px;
  padding: 1px 4px;
  background: var(--color-background-secondary);
  border-radius: 4px;
}
</style>
