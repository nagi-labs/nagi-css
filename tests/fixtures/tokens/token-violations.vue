<template>
  <article class="test-token-violations">
    <p class="p">x</p>
  </article>
</template>

<style scoped>
.test-token-violations {
  --local-accent: var(--palette-gray-100);

  background: var(--palette-red-500);

  > .p { color: var(--color-surfce); }
}
</style>
