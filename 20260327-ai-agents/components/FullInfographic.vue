<script setup>
import { ref } from 'vue'

const currentView = ref('primitives')
const views = [
  { id: 'primitives', label: 'Primitive' },
  { id: 'matrix', label: 'Vergleichsmatrix' },
  { id: 'protocols', label: 'LSP · MCP · ACP' },
  { id: 'flow', label: 'Zusammenspiel' },
  { id: 'worktrees', label: 'Git Worktrees' },
]
</script>

<template>
  <div class="infographic">
    <div class="nav">
      <button
        v-for="v in views"
        :key="v.id"
        :class="{ active: currentView === v.id }"
        @click.stop="currentView = v.id"
      >
        {{ v.label }}
      </button>
    </div>

    <div v-if="currentView === 'primitives'" class="view-content">
      <PrimitivesOverview />
    </div>
    <div v-if="currentView === 'matrix'" class="view-content">
      <ComparisonMatrix />
    </div>
    <div v-if="currentView === 'protocols'" class="view-content">
      <ProtocolCards />
    </div>
    <div v-if="currentView === 'flow'" class="view-content">
      <FlowLayers />
    </div>
    <div v-if="currentView === 'worktrees'" class="view-content">
      <WorktreeOverview />
    </div>
  </div>
</template>

<style scoped>
.infographic { font-family: 'DM Sans', sans-serif; }
.nav { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 10px; }
.nav button {
  font-size: 10px; font-weight: 500; padding: 4px 12px;
  border-radius: 16px; border: 1px solid rgba(0,0,0,0.1);
  background: white; color: #888; cursor: pointer; transition: all 0.15s;
}
.nav button:hover { border-color: #888; color: #1a1a18; }
.nav button.active { background: #1a1a18; color: white; border-color: #1a1a18; }
.view-content { min-height: 200px; }
</style>
