<script setup>
import { ref } from "vue";
import MonacoBlockAnnotated from "@shared/components/MonacoBlockAnnotated.vue";
import MonacoBlock from "@shared/components/MonacoBlock.vue";
import MethodMatcherTable from "./MethodMatcherTable.vue";
import JavaTemplateComparison from "./JavaTemplateComparison.vue";
import {
  sayHelloRecipeCode,
  sayHelloAnnotations,
  visitorMechanicsCode,
  visitorAnnotations,
  methodMatcherCode,
} from "./slide-data.ts";

const tabs = [
  { id: "anatomy", label: "Anatomie" },
  { id: "visitor", label: "Visitor" },
  { id: "matcher", label: "MethodMatcher" },
  { id: "template", label: "JavaTemplate" },
];
const active = ref("anatomy");
</script>

<template>
  <div class="rm-wrap">
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
      <template v-if="active === 'anatomy'">
        <p class="lead">
          Drei Teile: Metadaten/Optionen, Constructor, Visitor.
        </p>
        <MonacoBlockAnnotated
          :code="sayHelloRecipeCode"
          language="java"
          height="300px"
          :annotations="sayHelloAnnotations"
        />
      </template>

      <template v-else-if="active === 'visitor'">
        <p class="lead">
          Depth-first, <code>super.visitX()</code> ist Pflicht. Cursor liefert
          Parent-Kontext.
        </p>
        <MonacoBlockAnnotated
          :code="visitorMechanicsCode"
          language="java"
          height="200px"
          :annotations="visitorAnnotations"
        />
        <div class="callout">
          <strong>JavaIsoVisitor vs. JavaVisitor:</strong>
          Iso ist typerhaltend (Methode bleibt Methode). Faustregel: Iso, außer
          du musst.
        </div>
      </template>

      <template v-else-if="active === 'matcher'">
        <p class="lead">
          Syntax:
          <code>&lt;fqn.Type&gt; &lt;methodName&gt;(&lt;argTypes&gt;)</code>.
          Wildcards: <code>..</code> = beliebige Args, <code>*</code> =
          beliebiger Typ.
        </p>
        <MonacoBlock :code="methodMatcherCode" language="java" height="160px" />
        <MethodMatcherTable />
      </template>

      <template v-else-if="active === 'template'">
        <p class="lead">
          Niemals String-Concat — JavaTemplate parst mit Imports und Typen.
        </p>
        <JavaTemplateComparison />
        <div class="callout">
          <strong>Coordinates statt Positionen:</strong>
          <code>.replace()</code>, <code>.firstStatement()</code>,
          <code>.before()</code>, <code>.after()</code>. Imports via
          <code>maybeAddImport()</code>, niemals manuell an der CompilationUnit.
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.rm-wrap {
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
.callout {
  font-size: 13px;
  color: var(--color-text-secondary);
  background: var(--color-background-secondary);
  border-radius: var(--sk-rad);
  padding: 10px 14px;
  line-height: 1.55;
}
.callout strong {
  color: var(--color-text-primary);
  font-weight: 500;
}
.callout code {
  font-family: var(--font-mono);
  font-size: 0.92em;
  background: var(--color-background-primary);
  padding: 1px 5px;
  border-radius: 3px;
}
</style>
