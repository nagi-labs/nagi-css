<template>
  <article class="test-token-violations">
    <p class="text">x</p>
  </article>
</template>

<style scoped>
.test-token-violations {
  --local-accent: var(--palette-gray-100);

  background: var(--palette-red-500);

  > .text { color: var(--color-surfce); }
}
</style>
