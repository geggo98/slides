<script setup>
import { inject } from "vue";

const props = defineProps({
  tab: { type: String, required: true },
  section: { type: String, default: null },
  label: { type: String, required: true },
});

const skillNav = inject("skillNav", null);

function navigate() {
  if (skillNav) {
    skillNav.navigateTo(props.tab, props.section);
  }
}
</script>

<template>
  <span class="cross-ref" @click.stop="navigate">&#8594; {{ label }}</span>
</template>

<style scoped>
.cross-ref {
  font-size: 11px;
  color: var(--color-text-info);
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.15s;
}
.cross-ref:hover {
  opacity: 1;
  text-decoration: underline;
}
</style>
