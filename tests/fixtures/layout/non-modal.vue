<template>
  <dialog open class="test-non-modal">
    <span class="text">Non-modal notice</span>
  </dialog>
</template>
<style scoped>
.test-non-modal {
  position: relative;
  z-index: var(--z-notice);
  > .text { color: inherit; }
}
</style>
