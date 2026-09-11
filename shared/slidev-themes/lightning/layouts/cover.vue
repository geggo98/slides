<!--
  Titelfolie. Folie 1 ohne `layout:` läuft in Slidev automatisch über dieses
  Layout. Das Headmatter ist zugleich das Frontmatter von Folie 1, deshalb
  kommen `badge` und `badgeNote` als Props hier an:

    badge: false            blendet das Abzeichen aus
    badge: "Kurzvortrag"    ersetzt das Label
    badgeNote: "DuckDB"     Zusatz hinter den Minuten
-->
<script setup lang="ts">
import { computed } from "vue";
import { configs, handleBackground } from "@slidev/client";
import LightningBadge from "../components/LightningBadge.vue";
import LtBolt from "../components/LtBolt.vue";

// Vue setzt ein fehlendes Boolean-Prop auf false — ohne Default wäre das
// Abzeichen nur sichtbar, wenn das Deck `badge: true` schreibt.
const props = withDefaults(
  defineProps<{
    background?: string;
    badge?: boolean | string;
    badgeNote?: string;
  }>(),
  { background: "", badge: true, badgeNote: undefined },
);

const style = computed(() => handleBackground(props.background, true));
// `badge: false` im Frontmatter oder `themeConfig.badge: false` blendet aus —
// Letzteres schaltet auch das Footer-Label in global-top.vue ab.
const showBadge = computed(
  () =>
    props.badge !== false &&
    (configs.themeConfig as Record<string, unknown> | undefined)?.badge !==
      false,
);
const badgeLabel = computed(() =>
  typeof props.badge === "string" ? props.badge : undefined,
);
</script>

<template>
  <div class="slidev-layout cover" :style="style">
    <div class="lt-cover-body">
      <slot />
      <LightningBadge v-if="showBadge" :label="badgeLabel" :note="badgeNote" />
    </div>
    <LtBolt class="lt-bolt" />
  </div>
</template>
