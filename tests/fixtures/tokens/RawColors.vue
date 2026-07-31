<template>
  <article class="test-raw-colors">
    <p class="text">x</p>
  </article>
</template>

<style scoped>
.test-raw-colors {
  --local-accent: #f0a;

  background: var(--color-surface);
  border: 1px solid rgb(0 0 0 / 0.1);
  color: var(--color-text, #333);
  outline-color: CanvasText;

  > .text {
    background: linear-gradient(to right, white, var(--color-surface));
    color: currentColor;
    font-family: Tan, serif;
  }
}
</style>
