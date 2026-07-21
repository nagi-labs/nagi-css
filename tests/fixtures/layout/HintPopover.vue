<template>
  <section class="test-hint-popover">
    <p class="text">Tip</p>
  </section>
</template>
<style scoped>
.test-hint-popover {
  position: fixed;
  position-anchor: --hint;
  position-area: block-end;
  > .text { color: red; }
}
</style>
