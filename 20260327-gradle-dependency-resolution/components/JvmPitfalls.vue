<script setup>
const pitfalls = [
  {
    title: "Fehlende Toolchain",
    body: "Ohne <code>toolchain { ... }</code> kompiliert Gradle mit der Daemon-JVM. Dev-Maschine mit JDK 21, CI mit JDK 17 → unterschiedlicher Bytecode, schwer reproduzierbare Bugs.",
  },
  {
    title: "Toolchain ohne Resolver",
    body: "Seit Gradle 8.0 kein implizites JDK-Download mehr. <code>foojay-resolver-convention</code> in <code>settings.gradle</code> setzen — nicht in <code>build.gradle</code>, dort ignoriert es still.",
  },
  {
    title: "sourceCompatibility ohne release",
    body: "Cross-Kompilation auf Java 8/11 ohne <code>options.release</code> ist das Morling-Problem in Wartestellung. Betroffen: Apache Thrift, Elasticsearch Client, Classgraph — reale Produktionsfehler.",
  },
  {
    title: "org.gradle.java.home hart gepinnt",
    body: "<code>org.gradle.java.home=/absolute/path</code> in <code>gradle.properties</code>: bricht auf jeder Maschine, die diesen Pfad nicht hat. Variablen-Interpolation gibt es dort nicht. Ersatz: Daemon-Toolchain seit Gradle 9.2.",
  },
  {
    title: "JavaVersion.VERSION_X als Integer-Ersatz",
    body: "Der Enum endet irgendwann. <code>JavaLanguageVersion.of(26)</code> funktioniert auch für zukünftige Versionen ohne Gradle-Update.",
  },
  {
    title: "Gradle 9 Breaking: JUnit-Launcher",
    body: "Seit 9.0 wird <code>junit-platform-launcher</code> nicht mehr implizit geleakt. Explizite <code>testRuntimeOnly</code>-Dependency erforderlich, sonst Tests laufen nicht mehr.",
  },
];
</script>

<template>
  <div class="ig-section">
    <p class="ig-label">05 · Typische Legacy-Fallstricke</p>
    <h3 class="ig-title">Was in alten Projekten Probleme macht</h3>
    <div class="ig-pitfalls">
      <div v-for="p in pitfalls" :key="p.title" class="ig-pitfall">
        <p class="ig-pitfall-title">{{ p.title }}</p>
        <p class="ig-pitfall-body" v-html="p.body" />
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
  margin: 0 0 0.5rem;
}
.ig-title {
  font-size: 18px;
  font-weight: 500;
  margin: 0 0 0.9rem;
  color: var(--color-text-primary);
}
.ig-pitfalls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 8px;
}
.ig-pitfall {
  background: var(--color-background-secondary);
  border-radius: var(--border-radius-md);
  padding: 10px 12px;
  font-size: 12.5px;
  line-height: 1.5;
}
.ig-pitfall-title {
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0 0 2px;
  font-size: 13px;
}
.ig-pitfall-body {
  color: var(--color-text-secondary);
  margin: 0;
}
.ig-pitfall-body :deep(code) {
  font-family: var(--font-mono);
  font-size: 11.5px;
  padding: 1px 4px;
  background: var(--color-background-primary);
  border-radius: 4px;
}
</style>
