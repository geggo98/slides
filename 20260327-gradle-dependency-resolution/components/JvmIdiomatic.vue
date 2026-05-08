<script setup>
const daemonProps = `toolchainVersion=21
toolchainVendor=adoptium`;

const settingsKts = `plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}`;

const buildKts = `plugins {
    id("org.springframework.boot") version "4.0.6"
    id("io.spring.dependency-management") version "1.1.7"
    java
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
        vendor = JvmVendorSpec.ADOPTIUM
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.release.set(21)
}`;
</script>

<template>
  <div class="ig-section">
    <p class="ig-label">
      04 · Idiomatische Konfiguration 2026 — Spring Boot 3 auf JDK 21
    </p>

    <div class="ig-columns">
      <div class="ig-col ig-col-small">
        <div class="ig-file-block">
          <p class="ig-file-header">gradle/gradle-daemon-jvm.properties</p>
          <MonacoBlock :code="daemonProps" language="ini" height="60px" />
        </div>
        <div class="ig-file-block">
          <p class="ig-file-header">settings.gradle.kts</p>
          <MonacoBlock :code="settingsKts" language="kotlin" height="78px" />
        </div>
      </div>
      <div class="ig-col ig-col-main">
        <p class="ig-file-header">build.gradle.kts</p>
        <MonacoBlock :code="buildKts" language="kotlin" height="310px" />
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
.ig-intro :deep(code),
.ig-intro code {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 5px;
  background: var(--color-background-secondary);
  border-radius: 4px;
}

.ig-columns {
  display: grid;
  grid-template-columns: minmax(240px, 0.95fr) 1.05fr;
  gap: 14px;
  align-items: start;
}
.ig-col {
  display: flex;
  flex-direction: column;
}
.ig-file-block + .ig-file-block {
  margin-top: 8px;
}

.ig-file-header {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--color-text-tertiary);
  margin: 0 0 3px;
}
</style>
