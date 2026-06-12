<script setup>
import Tabs from "@shared/components/Tabs.vue";
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
  { key: "anatomy", label: "Anatomie" },
  { key: "visitor", label: "Visitor" },
  { key: "matcher", label: "MethodMatcher" },
  { key: "template", label: "JavaTemplate" },
];
</script>

<template>
  <div class="rm-wrap">
    <Tabs :tabs="tabs" aria-label="Recipe-Mechanik">
      <template #anatomy>
        <div class="panel">
          <p class="lead">
            Drei Teile: Metadaten/Optionen, Constructor, Visitor.
          </p>
          <MonacoBlockAnnotated
            :code="sayHelloRecipeCode"
            language="java"
            height="250px"
            :annotations="sayHelloAnnotations"
          />
        </div>
      </template>

      <template #visitor>
        <div class="panel">
          <p class="lead">
            Depth-first, <code>super.visitX()</code> ist Pflicht. Cursor liefert
            Parent-Kontext.
          </p>
          <MonacoBlockAnnotated
            :code="visitorMechanicsCode"
            language="java"
            height="180px"
            :annotations="visitorAnnotations"
          />
          <div class="callout">
            <strong>JavaIsoVisitor vs. JavaVisitor:</strong>
            Iso ist typerhaltend (Methode bleibt Methode). Faustregel: Iso,
            außer du musst.
          </div>
        </div>
      </template>

      <template #matcher>
        <div class="panel">
          <p class="lead">
            Syntax:
            <code>&lt;fqn.Type&gt; &lt;methodName&gt;(&lt;argTypes&gt;)</code>.
            Wildcards: <code>..</code> = beliebige Args, <code>*</code> =
            beliebiger Typ.
          </p>
          <MonacoBlock
            :code="methodMatcherCode"
            language="java"
            height="160px"
          />
          <MethodMatcherTable />
        </div>
      </template>

      <template #template>
        <div class="panel">
          <p class="lead">
            Niemals String-Concat — JavaTemplate parst mit Imports und Typen.
          </p>
          <JavaTemplateComparison />
          <div class="callout">
            <strong>Coordinates statt Positionen:</strong>
            <code>.replace()</code>, <code>.firstStatement()</code>,
            <code>.before()</code>, <code>.after()</code>. Imports via
            <code>maybeAddImport()</code>, niemals manuell an der
            CompilationUnit.
          </div>
        </div>
      </template>
    </Tabs>
  </div>
</template>

<style scoped>
.rm-wrap {
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
