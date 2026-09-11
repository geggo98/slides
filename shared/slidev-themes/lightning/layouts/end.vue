<!--
  Schlussfolie in Hell und Dunkel. Slidevs Builtin ist hart schwarz mit
  weißem Text und `select-none`; hier bleibt die Quellenzeile markierbar.
-->
<script setup lang="ts">
import LtBolt from "../components/LtBolt.vue";
</script>

<template>
  <div class="slidev-layout end">
    <div class="lt-end-body">
      <slot>Danke</slot>
    </div>
    <LtBolt class="lt-bolt" />
  </div>
</template>
