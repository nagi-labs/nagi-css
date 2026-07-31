<template>
  <article class="test-token-surface">
    <p class="text">x</p>
  </article>
</template>

<style scoped>
.test-token-surface {
  --local-hairline-nudge: -1px;

  background: var(--color-surface);
  padding: var(--space-3);
  translate: 0 var(--local-hairline-nudge);
  color: var(--date-picker-accent-color);

  > .text { color: var(--color-danger-text); }
}
</style>
