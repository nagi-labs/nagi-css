<template>
  <dialog class="test-confirm-modal">
    <p class="p">Sure?</p>
  </dialog>
</template>
<style scoped>
.test-confirm-modal {
  margin: auto;
  inset: 0;
  z-index: var(--z-modal);
  > .p { color: inherit; }
}
</style>
