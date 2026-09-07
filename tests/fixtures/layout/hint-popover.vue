<template>
  <section class="test-hint-popover">
    <p class="p">Tip</p>
  </section>
</template>
<style scoped>
.test-hint-popover {
  position: fixed;
  position-anchor: --hint;
  position-area: block-end;
  > .p { color: inherit; }
}
</style>
