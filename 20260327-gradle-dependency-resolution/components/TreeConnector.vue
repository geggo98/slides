<script setup>
defineProps({
  type: { type: String, default: 'single' }, // single, fork, parallel
  width: { type: Number, default: 180 },
})
</script>

<template>
  <div
    v-if="type === 'single'"
    class="tc tc-single"
  />
  <div
    v-else-if="type === 'fork'"
    class="tc tc-fork"
    :style="{ width: width + 'px' }"
  />
  <div
    v-else-if="type === 'parallel'"
    class="tc tc-parallel"
    :style="{ width: width + 'px' }"
  />
</template>

<style scoped>
.tc { margin: 0 auto; }

/* Single vertical line */
.tc-single {
  width: 1.5px;
  height: 20px;
  background: var(--color-text-tertiary);
}

/* Fork: one stem splits into two branches */
.tc-fork {
  height: 24px;
  position: relative;
}
.tc-fork::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  width: 1.5px;
  height: 50%;
  background: var(--color-text-tertiary);
  transform: translateX(-50%);
}
.tc-fork::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 50%;
  border-top: 1.5px solid var(--color-text-tertiary);
  border-left: 1.5px solid var(--color-text-tertiary);
  border-right: 1.5px solid var(--color-text-tertiary);
}

/* Two parallel vertical lines */
.tc-parallel {
  height: 20px;
  position: relative;
  border-left: 1.5px solid var(--color-text-tertiary);
  border-right: 1.5px solid var(--color-text-tertiary);
}
</style>
