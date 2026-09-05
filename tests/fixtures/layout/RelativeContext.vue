<template>
  <article class="test-relative-context">
    <span class="icon">!</span>
  </article>
</template>
<style scoped>
.test-relative-context {
  position: relative;
  > .icon {
    position: absolute;
    inset-block-start: 0;
    inset-inline-end: 0;
  }
}
</style>
