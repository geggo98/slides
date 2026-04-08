<script setup>
import { ref, watch, inject } from "vue";

const props = defineProps({
  id: { type: String, required: true },
  title: { type: String, required: true },
  open: { type: Boolean, default: false },
});

const isOpen = ref(props.open);
const toggle = () => {
  isOpen.value = !isOpen.value;
};

const skillNav = inject("skillNav", null);

if (skillNav) {
  watch(
    () => skillNav.activeSection.value,
    (newSection) => {
      if (newSection === props.id) {
        isOpen.value = true;
      }
    },
  );
}
</script>

<template>
  <div :id="`section-${id}`" class="section" :class="{ open: isOpen }">
    <div class="section-head" @click.stop="toggle">
      {{ title }}
      <span class="chevron">&#9654;</span>
    </div>
    <div class="section-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.section {
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--sk-rad);
  margin-bottom: 10px;
  overflow: hidden;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  cursor: pointer;
  user-select: none;
  font-size: 14px;
  font-weight: 500;
  background: var(--color-background-primary);
  transition: background 0.15s;
}
.section-head:hover {
  background: var(--color-background-secondary);
}
.chevron {
  font-size: 11px;
  color: var(--color-text-tertiary);
  transition: transform 0.2s;
}
.section.open .chevron {
  transform: rotate(90deg);
}
.section-body {
  display: none;
  padding: 0 1rem 1rem;
  font-size: 13px;
  line-height: 1.7;
  color: var(--color-text-secondary);
}
.section.open .section-body {
  display: block;
}
</style>
