<script setup>
import "./recipe-tabs.css";
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
  <div class="or-tabs">
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
