<template>
  <dialog class="test-raw-stacking">
    <p class="p">Sure?</p>
  </dialog>
</template>
<style scoped>
.test-raw-stacking {
  margin: auto;
  inset: 0;
  z-index: 100;
  > .p { color: inherit; z-index: 2; }
}
</style>
