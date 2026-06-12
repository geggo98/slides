<script setup>
import Tabs from "@shared/components/Tabs.vue";
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
  { key: "precond", label: "Preconditions" },
  { key: "yaml", label: "Declarative YAML" },
  { key: "boot", label: "Spring Boot Komposition" },
];
</script>

<template>
  <div class="rk-wrap">
    <Tabs :tabs="tabs" aria-label="Recipe-Komposition">
      <template #precond>
        <div class="panel">
          <p class="lead">
            Unterschied zwischen 30 Sekunden und zwei Stunden Recipe-Lauf.
            Preconditions filtern bereits geparste Files — sparen
            <em>Edit</em>-, nicht <em>Parse</em>-Aufwand.
          </p>
          <MonacoBlock
            :code="preconditionsCode"
            language="java"
            height="160px"
          />
          <PreconditionsTable />
        </div>
      </template>

      <template #yaml>
        <div class="panel">
          <p class="lead">
            Die <code>UpgradeSpringBoot_X_Y</code>-Recipes sind fast komplett
            YAML — keine Java-Klasse, nur Komposition vorhandener Recipes.
          </p>
          <MonacoBlockAnnotated
            :code="yamlRecipeCode"
            language="yaml"
            height="270px"
            :annotations="yamlRecipeAnnotations"
          />
        </div>
      </template>

      <template #boot>
        <div class="panel">
          <p class="lead">
            <code>UpgradeSpringBoot_4_0</code> als Composite — zieht alle
            Begleit-Upgrades rekursiv mit.
          </p>
          <SpringBootCompositionTree />
        </div>
      </template>
    </Tabs>
  </div>
</template>

<style scoped>
.rk-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  --sk-tab-gap: 6px;
  --sk-tab-bar-mb: 10px;
  --sk-tab-bar-pb: 8px;
  --sk-tab-bar-border-bottom: 0.5px solid var(--color-border-tertiary);
  --sk-tab-font-weight: inherit;
  --sk-tab-pad: 6px 12px;
  --sk-tab-border: 0.5px solid var(--color-border-tertiary);
  --sk-tab-radius: var(--sk-rad);
  --sk-tab-hover-bg: transparent;
  --sk-tab-transition: none;
  --sk-tab-active-bg: var(--color-background-info);
  --sk-tab-active-color: var(--color-text-info);
  --sk-tab-active-border: var(--color-border-info);
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
