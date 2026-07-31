<template>
  <article class="test-motion-surface">
    <p class="text">x</p>
  </article>
</template>

<style scoped>
@keyframes test-motion-surface-fade-in {
  from { opacity: 0; }
}

@keyframes test-motion-surface-unused {
  from { opacity: 0; }
}

@layer component {
  .test-motion-surface {
    > .text { opacity: 1; }
  }
}

.test-motion-surface {
  animation: test-motion-surface-fade-in 200ms ease both;
}
</style>
