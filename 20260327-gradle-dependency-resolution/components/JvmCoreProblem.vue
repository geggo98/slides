<script setup>
import { ref, computed } from "vue";

const scenarios = {
  legacy: [
    {
      label: "Quellcode",
      value: "ByteBuffer buf = ...; buf.position(0);",
      cls: "",
    },
    {
      label: "javac sieht",
      value: "Java-21-API von ByteBuffer (die kovariante Rückgabe ab JDK 9)",
      cls: "",
    },
    {
      label: "Bytecode",
      value:
        "invokevirtual java/nio/ByteBuffer.position(I)Ljava/nio/ByteBuffer;",
      cls: "",
    },
    {
      label: "Auf JRE 8",
      value: "NoSuchMethodError — Signatur existiert erst ab JDK 9",
      cls: "fail",
    },
  ],
  release: [
    {
      label: "Quellcode",
      value: "ByteBuffer buf = ...; buf.position(0);",
      cls: "",
    },
    {
      label: "javac sieht",
      value: "Java-8-API via ct.sym — nur die geerbte Buffer.position(int)",
      cls: "",
    },
    {
      label: "Bytecode",
      value: "invokevirtual java/nio/Buffer.position(I)Ljava/nio/Buffer;",
      cls: "",
    },
    {
      label: "Auf JRE 8",
      value: "Funktioniert — korrekte Methoden-Resolution zur Laufzeit",
      cls: "ok",
    },
  ],
};

const scenario = ref("legacy");
const steps = computed(() => scenarios[scenario.value]);
</script>

<template>
  <div class="ig-section">
    <p class="ig-label">02 · Das Kernproblem</p>
    <h3 class="ig-title">
      Warum
      <code class="inline-code">-target 8</code>
      nicht dasselbe ist wie
      <code class="inline-code">--release 8</code>
    </h3>
    <p class="ig-intro">
      Das klassische Beispiel (Gunnar Morling): Build-JDK ist 21, Ziel ist JRE
      8, Quellcode nutzt
      <code>ByteBuffer.position(int)</code>. Dieselbe Zeile, zwei
      Konfigurationen — und zwei grundverschiedene Ergebnisse.
    </p>

    <div class="ig-toggle">
      <button
        type="button"
        :class="{ active: scenario === 'legacy' }"
        @click.stop="scenario = 'legacy'"
      >
        -source 8 -target 8
      </button>
      <button
        type="button"
        :class="{ active: scenario === 'release' }"
        @click.stop="scenario = 'release'"
      >
        --release 8
      </button>
    </div>

    <div :key="scenario" class="ig-scenario">
      <div v-for="s in steps" :key="s.label" class="ig-step" :class="s.cls">
        <span class="step-label">{{ s.label }}</span>
        <span class="step-value">{{ s.value }}</span>
      </div>
    </div>

    <p class="ig-intro" style="margin: 0.8rem 0 0">
      <code>sourceCompatibility</code>/<code>targetCompatibility</code> setzen
      nur <code>-source</code>/<code>-target</code>. Sprachfeatures und
      Classfile-Version werden beschränkt — die sichtbare JDK-API bleibt die des
      Build-JDK. Der Fehler fällt erst zur Laufzeit auf.
      <code>--release</code> zieht die API-Sicht aus <code>lib/ct.sym</code> des
      Ziel-JDK (JEP 247, seit JDK 9) und fängt das beim Kompilieren ab.
    </p>
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
.ig-title .inline-code {
  font-family: var(--font-mono);
  font-size: 14px;
  padding: 1px 5px;
  background: var(--color-background-secondary);
  border-radius: 4px;
  font-weight: 500;
}
.ig-intro {
  font-size: 12.5px;
  color: var(--color-text-secondary);
  line-height: 1.55;
  margin: 0 0 0.8rem;
}
.ig-intro :deep(code),
.ig-intro code {
  font-family: var(--font-mono);
  font-size: 11.5px;
  padding: 1px 5px;
  background: var(--color-background-secondary);
  border-radius: 4px;
}

.ig-toggle {
  display: inline-flex;
  background: var(--color-background-secondary);
  border-radius: var(--border-radius-md);
  padding: 3px;
  gap: 3px;
  margin-bottom: 0.7rem;
  flex-wrap: wrap;
}
.ig-toggle button {
  border: 0.5px solid transparent;
  background: transparent;
  padding: 5px 11px;
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-family: var(--font-mono);
}
.ig-toggle button.active {
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  border-color: var(--color-border-tertiary);
}

.ig-scenario {
  display: grid;
  grid-template-columns: 1fr;
  gap: 5px;
}
.ig-step {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 12px;
  font-size: 12.5px;
  padding: 8px 12px;
  background: var(--color-background-secondary);
  border-radius: var(--border-radius-md);
  align-items: center;
}
.ig-step .step-label {
  color: var(--color-text-tertiary);
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.ig-step .step-value {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--color-text-primary);
  line-height: 1.5;
}
.ig-step.fail {
  background: var(--color-background-danger);
}
.ig-step.fail .step-value,
.ig-step.fail .step-label {
  color: var(--color-text-danger);
}
.ig-step.ok {
  background: var(--color-background-success);
}
.ig-step.ok .step-value,
.ig-step.ok .step-label {
  color: var(--color-text-success);
}
</style>
