<script setup lang="ts">
/**
 * Shared tab bar — owns the active-tab state, ARIA roles and keyboard
 * navigation (←/→/Home/End) that were re-implemented divergently across decks
 * (`.tab-bar`, `.tab-btn`, `.tabs`, `.eco-tabs`). Content goes in one named
 * slot per tab key:
 *
 *   <Tabs :tabs="[{key:'a',label:'A'},{key:'b',label:'B'}]">
 *     <template #a> … </template>
 *     <template #b> … </template>
 *   </Tabs>
 *
 * Look is preserved per deck via CSS custom properties (see <style>), so a
 * migration is a visual no-op: set the handful of `--sk-tab-*` vars on the
 * wrapper to match the deck's previous styling. Supports v-model for decks
 * that need the active key outside the component.
 */
import { computed, ref, watch } from "vue";

interface Tab {
  key: string;
  label: string;
}

const props = defineProps<{
  tabs: Tab[];
  modelValue?: string;
  initial?: string;
  ariaLabel?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [string] }>();

const internal = ref(
  props.modelValue ?? props.initial ?? props.tabs[0]?.key ?? "",
);
watch(
  () => props.modelValue,
  (v) => {
    if (v != null) internal.value = v;
  },
);

const active = computed<string>({
  get: () => props.modelValue ?? internal.value,
  set: (v) => {
    internal.value = v;
    emit("update:modelValue", v);
  },
});

function select(key: string) {
  active.value = key;
}

function onKey(e: KeyboardEvent, i: number) {
  const n = props.tabs.length;
  if (n === 0) return;
  let next = i;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % n;
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + n) % n;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = n - 1;
  else return;
  e.preventDefault();
  e.stopPropagation();
  select(props.tabs[next]!.key);
}
</script>

<template>
  <div class="sk-tabs">
    <div class="sk-tab-bar" role="tablist" :aria-label="ariaLabel">
      <button
        v-for="(t, i) in tabs"
        :key="t.key"
        class="sk-tab"
        :class="{ active: active === t.key }"
        role="tab"
        type="button"
        :aria-selected="active === t.key"
        :tabindex="active === t.key ? 0 : -1"
        @click.stop="select(t.key)"
        @keydown="onKey($event, i)"
      >
        <slot name="tab" :tab="t" :active="active === t.key">{{
          t.label
        }}</slot>
      </button>
    </div>
    <div class="sk-tab-panel">
      <!-- Per-tab content: one named slot per key (<template #keyA>). -->
      <slot :name="active" :active="active" />
      <!-- Data-driven decks render a single panel from the active key via the
           default scoped slot: <Tabs v-model=… v-slot="{ active }">…</Tabs>. -->
      <slot :active="active" />
    </div>
  </div>
</template>

<style scoped>
.sk-tabs {
  width: 100%;
}
.sk-tab-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sk-tab-gap, 4px);
  margin-bottom: var(--sk-tab-bar-mb, 12px);
  padding-bottom: var(--sk-tab-bar-pb, 0);
  border-bottom: var(--sk-tab-bar-border-bottom, none);
}
.sk-tab {
  font-family: inherit;
  font-size: var(--sk-tab-font-size, 12px);
  font-weight: var(--sk-tab-font-weight, 500);
  padding: var(--sk-tab-pad, 5px 14px);
  border: var(--sk-tab-border, 1px solid var(--color-border-tertiary));
  border-radius: var(--sk-tab-radius, var(--border-radius-lg));
  background: var(--sk-tab-bg, transparent);
  color: var(--sk-tab-color, var(--color-text-secondary));
  cursor: pointer;
  /* Default matches the JavaVersionsMatrix original; decks whose tabs had no
     transition set --sk-tab-transition: none for an exact no-op. */
  transition: var(
    --sk-tab-transition,
    background 0.15s,
    color 0.15s,
    border-color 0.15s
  );
}
.sk-tab:hover {
  background: var(--sk-tab-hover-bg, var(--color-background-secondary));
}
.sk-tab.active {
  background: var(--sk-tab-active-bg, var(--color-background-secondary));
  color: var(--sk-tab-active-color, var(--color-text-primary));
  border-color: var(--sk-tab-active-border, var(--color-text-secondary));
  /* Defaults to the base weight; set this when active tabs were heavier than
     inactive (e.g. inactive 400 / active 500). */
  font-weight: var(--sk-tab-active-font-weight, var(--sk-tab-font-weight, 500));
}
.sk-tab-panel {
  width: 100%;
}
</style>
