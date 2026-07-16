<template>
  <section class="hint-popover">
    <p class="text">Tip</p>
  </section>
</template>
<style scoped>
.hint-popover {
  position: fixed;
  position-anchor: --hint;
  position-area: block-end;
  > .text { color: red; }
}
</style>
