<template>
  <main class="demo-app">
    <h1 class="title">Nagi CSS minimal example</h1>
    <span class="text">The template and its owned CSS are checked together.</span>
  </main>
</template>

<style scoped>
.demo-app {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-8);

  > .title { margin: 0; }
  > .text { color: CanvasText; }
}
</style>
