<template>
  <dialog class="test-raw-stacking">
    <p class="text">Sure?</p>
  </dialog>
</template>
<style scoped>
.test-raw-stacking {
  margin: auto;
  inset: 0;
  z-index: 100;
  > .text { color: inherit; z-index: 2; }
}
</style>
