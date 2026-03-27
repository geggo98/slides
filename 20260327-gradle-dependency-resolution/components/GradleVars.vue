<script setup>
// Shared CSS variables provider - wrap content in this component
</script>

<template>
  <div class="gradle-vars">
    <slot />
  </div>
</template>

<style>
.gradle-vars {
  --font-sans: 'Slidev', system-ui, -apple-system, sans-serif;
  --font-mono: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
  --color-background-primary: #fff;
  --color-background-secondary: #f5f5f3;
  --color-background-tertiary: #ececea;
  --color-background-info: #E6F1FB;
  --color-background-success: #EAF3DE;
  --color-background-warning: #FAEEDA;
  --color-background-danger: #FCEBEB;
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #6b6b6b;
  --color-text-tertiary: #999;
  --color-text-info: #0C447C;
  --color-text-success: #27500A;
  --color-text-warning: #633806;
  --color-text-danger: #791F1F;
  --color-border-tertiary: rgba(0,0,0,0.12);
  --color-border-secondary: rgba(0,0,0,0.2);
  --color-border-primary: rgba(0,0,0,0.35);
  --color-border-info: #85B7EB;
  --color-border-success: #97C459;
  --color-border-warning: #EF9F27;
  --color-border-danger: #F09595;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
}

.dark .gradle-vars {
  --color-background-primary: #1e1e1e;
  --color-background-secondary: #2a2a2a;
  --color-background-tertiary: #333;
  --color-background-info: #042C53;
  --color-background-success: #173404;
  --color-background-warning: #412402;
  --color-background-danger: #501313;
  --color-text-primary: #e5e5e5;
  --color-text-secondary: #aaa;
  --color-text-tertiary: #777;
  --color-text-info: #85B7EB;
  --color-text-success: #97C459;
  --color-text-warning: #EF9F27;
  --color-text-danger: #F09595;
  --color-border-tertiary: rgba(255,255,255,0.1);
  --color-border-secondary: rgba(255,255,255,0.18);
  --color-border-primary: rgba(255,255,255,0.3);
  --color-border-info: #185FA5;
  --color-border-success: #3B6D11;
  --color-border-warning: #854F0B;
  --color-border-danger: #A32D2D;
}
</style>
