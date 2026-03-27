<script setup>
import { ref } from 'vue'

const props = defineProps({
  icon: { type: String, default: '' },
  name: { type: String, required: true },
  analogy: { type: String, default: '' },
  purpose: { type: String, default: '' },
  type: { type: String, default: '' },
  context: { type: String, default: '' },
  bg: { type: String, default: '#EEEDFE' },
  color: { type: String, default: '#3C3489' },
  typeBg: { type: String, default: '#FAEEDA' },
  typeColor: { type: String, default: '#633806' },
  when: { type: String, default: '' },
  whenNot: { type: String, default: '' },
})

const open = ref(false)
</script>

<template>
  <div
    class="prim-card"
    :class="{ open }"
    @click="open = !open"
  >
    <div class="prim-header">
      <div class="prim-icon" :style="{ background: bg, color }">{{ icon }}</div>
      <div>
        <div class="prim-title">{{ name }}</div>
        <div class="prim-analogy">{{ analogy }}</div>
      </div>
    </div>
    <div class="prim-purpose">{{ purpose }}</div>
    <div class="prim-badges">
      <span class="prim-badge" :style="{ background: typeBg, color: typeColor }">{{ type }}</span>
      <span class="prim-badge neutral">{{ context }}</span>
    </div>
    <div v-if="open" class="prim-detail">
      <div class="prim-detail-section">
        <strong>Wann verwenden</strong>
        <p v-html="when" />
      </div>
      <div class="prim-detail-section">
        <strong>Wann NICHT</strong>
        <p v-html="whenNot" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.prim-card {
  background: white;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: border-color 0.2s;
  color: #1a1a18;
}
.prim-card:hover { border-color: #888; }
.prim-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.prim-icon {
  width: 26px; height: 26px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; flex-shrink: 0;
}
.prim-title { font-size: 11px; font-weight: 600; color: #1a1a18; }
.prim-analogy { font-size: 9px; color: #888; }
.prim-purpose { font-size: 9px; color: #5f5e5a; line-height: 1.3; }
.prim-badges { margin-top: 3px; }
.prim-badge {
  display: inline-block; font-size: 8px; font-weight: 600;
  padding: 1px 5px; border-radius: 6px; margin-right: 2px;
}
.prim-badge.neutral { background: #f3f2ee; color: #5f5e5a; }
.prim-detail {
  margin-top: 6px; padding: 6px 8px;
  background: #f3f2ee; border-radius: 6px; font-size: 9px; line-height: 1.4;
  color: #1a1a18;
}
.prim-detail-section { margin-bottom: 4px; }
.prim-detail-section:last-child { margin-bottom: 0; }
.prim-detail-section strong { font-size: 9px; display: block; margin-bottom: 1px; color: #1a1a18; }
</style>
