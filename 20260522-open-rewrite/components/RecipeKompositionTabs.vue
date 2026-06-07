<script setup>
import { ref } from "vue";
import MonacoBlock from "@shared/components/MonacoBlock.vue";
import MonacoBlockAnnotated from "@shared/components/MonacoBlockAnnotated.vue";
import PreconditionsTable from "./PreconditionsTable.vue";
import SpringBootCompositionTree from "./SpringBootCompositionTree.vue";
import {
  preconditionsCode,
  yamlRecipeCode,
  yamlRecipeAnnotations,
} from "./slide-data.ts";

const tabs = [
  { id: "precond", label: "Preconditions" },
  { id: "yaml", label: "Declarative YAML" },
  { id: "boot", label: "Spring Boot Komposition" },
];
const active = ref("precond");
</script>

<template>
  <div class="rk-wrap">
    <div class="tab-bar">
      <button
        v-for="t in tabs"
        :key="t.id"
        :class="{ active: active === t.id }"
        type="button"
        @click.stop="active = t.id"
      >
        {{ t.label }}
      </button>
    </div>

    <div :key="active" class="panel">
      <template v-if="active === 'precond'">
        <p class="lead">
          Unterschied zwischen 30 Sekunden und zwei Stunden Recipe-Lauf.
          Preconditions filtern bereits geparste Files — sparen <em>Edit</em>-,
          nicht <em>Parse</em>-Aufwand.
        </p>
        <MonacoBlock :code="preconditionsCode" language="java" height="160px" />
        <PreconditionsTable />
      </template>

      <template v-else-if="active === 'yaml'">
        <p class="lead">
          Die <code>UpgradeSpringBoot_X_Y</code>-Recipes sind fast komplett YAML
          — keine Java-Klasse, nur Komposition vorhandener Recipes.
        </p>
        <MonacoBlockAnnotated
          :code="yamlRecipeCode"
          language="yaml"
          height="320px"
          :annotations="yamlRecipeAnnotations"
        />
      </template>

      <template v-else-if="active === 'boot'">
        <p class="lead">
          <code>UpgradeSpringBoot_4_0</code> als Composite — zieht alle
          Begleit-Upgrades rekursiv mit.
        </p>
        <SpringBootCompositionTree />
      </template>
    </div>
  </div>
</template>

<style scoped>
.rk-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tab-bar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  padding-bottom: 8px;
}
.tab-bar button {
  font: inherit;
  font-size: 12px;
  padding: 6px 12px;
  background: transparent;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--sk-rad);
  cursor: pointer;
  color: var(--color-text-secondary);
}
.tab-bar button.active {
  background: var(--color-background-info);
  color: var(--color-text-info);
  border-color: var(--color-border-info);
}
.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lead {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.55;
}
.lead code {
  font-family: var(--font-mono);
  font-size: 0.92em;
  background: var(--color-background-secondary);
  padding: 1px 5px;
  border-radius: 3px;
}
</style>
