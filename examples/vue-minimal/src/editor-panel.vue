<script setup>
import FormatControls from "./format-controls.vue"
</script>

<template>
  <main class="app-editor-panel">
    <header class="header">
      <h1 class="title">Nagi CSS</h1>
      <span class="text">
        Markup and component CSS, checked as one structural contract.
      </span>
    </header>

    <format-controls />
  </main>
</template>

<style scoped>
.app-editor-panel {
  display: grid;
  align-content: center;
  justify-items: center;
  min-block-size: 100vh;
  gap: var(--space-7);
  padding: var(--space-8);
  color: var(--color-text);
  background: var(--color-canvas);

  > .header {
    display: grid;
    inline-size: min(100%, 44rem);
    gap: var(--space-2);

    > .title {
      margin: 0;
      font-size: var(--font-size-5);
      line-height: 1;
    }

    > .text {
      color: var(--color-text-muted);
      font-size: var(--font-size-2);
      line-height: 1.5;
    }
  }

  > .app-format-controls {
    inline-size: min(100%, 44rem);
  }
}

@media (width < 30rem) {
  .app-editor-panel {
    padding: var(--space-4);
  }
}
</style>
