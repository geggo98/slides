<!--
  Shared design tokens for Slidev decks. Defines CSS variables on :root
  (light) and html.dark / body.dark (dark), so they apply globally to all
  slides — no wrapper needed.

  Originally lifted from 20260327-gradle-dependency-resolution/components/
  GradleVars.vue, where the same tokens were scoped to .gradle-vars; here
  they are global so any talk can use them by mounting <SlidevTokens />
  once.

  How to use:
  - In slides.md, render `<SlidevTokens />` once anywhere (it's invisible).
  - In Vue components, reference vars like `var(--color-text-primary)`,
    `var(--color-background-info)`, etc.

  The component renders a zero-size placeholder so it can be invoked from
  Markdown without affecting layout.

  SOURCE OF TRUTH: the values below mirror shared/theme/tokens.ts. Edit the
  palette THERE (it also feeds the JS-side usePalette() composable); the
  static CSS here is kept in lock-step by shared/theme/__tests__/tokens.test.ts
  (drift guard). The CSS stays static on purpose — bundled as CSS it avoids a
  flash-of-unstyled-content that runtime injection would risk.
-->
<template>
  <span aria-hidden="true" class="slidev-tokens-marker" />
</template>

<style>
:root {
  --color-background-primary: #fff;
  --color-background-secondary: #f5f5f3;
  --color-background-tertiary: #ececea;
  --color-background-info: #e6f1fb;
  --color-background-success: #eaf3de;
  --color-background-warning: #faeeda;
  --color-background-danger: #fcebeb;
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #6b6b6b;
  --color-text-tertiary: #999;
  --color-text-info: #0c447c;
  --color-text-success: #27500a;
  --color-text-warning: #633806;
  --color-text-danger: #791f1f;
  --color-border-tertiary: rgba(0, 0, 0, 0.12);
  --color-border-secondary: rgba(0, 0, 0, 0.2);
  --color-border-primary: rgba(0, 0, 0, 0.35);
  --color-border-info: #85b7eb;
  --color-border-success: #97c459;
  --color-border-warning: #ef9f27;
  --color-border-danger: #f09595;
  --sk-rad: 6px;
  --sk-radm: 8px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
}

html.dark,
.dark,
:root.dark {
  --color-background-primary: #1e1e1e;
  --color-background-secondary: #2a2a2a;
  --color-background-tertiary: #333;
  --color-background-info: #042c53;
  --color-background-success: #173404;
  --color-background-warning: #412402;
  --color-background-danger: #501313;
  --color-text-primary: #e5e5e5;
  --color-text-secondary: #aaa;
  --color-text-tertiary: #777;
  --color-text-info: #85b7eb;
  --color-text-success: #97c459;
  --color-text-warning: #ef9f27;
  --color-text-danger: #f09595;
  --color-border-tertiary: rgba(255, 255, 255, 0.1);
  --color-border-secondary: rgba(255, 255, 255, 0.18);
  --color-border-primary: rgba(255, 255, 255, 0.3);
  --color-border-info: #185fa5;
  --color-border-success: #3b6d11;
  --color-border-warning: #854f0b;
  --color-border-danger: #a32d2d;
}

.slidev-tokens-marker {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
  overflow: hidden;
}
</style>
