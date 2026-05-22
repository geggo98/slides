<script setup>
function licClass(l) {
  if (l.startsWith("Apache")) return "ok";
  if (l === "MSAL") return "warn";
  return "neutral";
}

const modules = [
  {
    name: "rewrite-spring",
    purpose: "Spring-Boot-Migrationen — UpgradeSpringBoot_2_1 … _4_0",
    license: "MSAL",
  },
  {
    name: "rewrite-migrate-java",
    purpose: "Java-Versions, javax → jakarta, deprecated APIs",
    license: "Apache 2.0",
  },
  {
    name: "rewrite-testing-frameworks",
    purpose: "JUnit 4 → 5, Hamcrest → AssertJ, Mockito",
    license: "Apache 2.0",
  },
  {
    name: "rewrite-static-analysis",
    purpose: "Linter-Sammlung mit Auto-Fix",
    license: "Apache 2.0",
  },
  {
    name: "rewrite-logging-frameworks",
    purpose: "Log4j 1.x → SLF4J, Log4Shell-Patches",
    license: "Apache 2.0",
  },
  {
    name: "rewrite-hibernate",
    purpose: "Hibernate 5 → 6 → 7, javax.persistence → jakarta",
    license: "MSAL",
  },
  {
    name: "rewrite-jenkins / quarkus / micrometer",
    purpose: "Framework-spezifische Sammlungen",
    license: "gemischt",
  },
];
</script>

<template>
  <table class="catalog">
    <thead>
      <tr>
        <th>Modul</th>
        <th>Zweck</th>
        <th>Lizenz</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="m in modules" :key="m.name">
        <td>
          <code>{{ m.name }}</code>
        </td>
        <td>{{ m.purpose }}</td>
        <td>
          <span :class="['lic', licClass(m.license)]">{{ m.license }}</span>
        </td>
      </tr>
    </tbody>
  </table>
  <p class="hint">
    Plus: YAML, XML, JSON, Properties, Maven/Gradle, Dockerfiles, Terraform,
    Kubernetes — derselbe LST-Ansatz für Konfigurationsdateien.
  </p>
</template>

<style scoped>
.catalog {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.catalog th {
  text-align: left;
  font-weight: 500;
  padding: 8px 10px;
  border-bottom: 0.5px solid var(--color-border-secondary);
  color: var(--color-text-secondary);
}
.catalog td {
  padding: 7px 10px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  vertical-align: top;
}
.catalog code {
  font-family: var(--font-mono);
  font-size: 12px;
}
.lic {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}
.lic.ok {
  background: var(--color-background-success);
  color: var(--color-text-success);
}
.lic.warn {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
}
.lic.neutral {
  background: var(--color-background-secondary);
  color: var(--color-text-secondary);
}
.hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin: 12px 0 0;
}
</style>
