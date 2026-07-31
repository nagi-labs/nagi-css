<template>
  <article class="test-raw-lengths">
    <p class="text">x</p>
  </article>
</template>

<style scoped>
.test-raw-lengths {
  /* the named escape: a one-off magnitude with a reason attached */
  --local-hairline-nudge: -1px;

  padding: var(--space-3) 0;
  gap: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  inline-size: 32rem;
  translate: 0 var(--local-hairline-nudge);

  > .text {
    font-size: 1.125rem;
    line-height: 1.5;
    margin-inline: calc(var(--space-3) * -1);
  }
}
</style>
