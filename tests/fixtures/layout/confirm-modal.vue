<template>
  <dialog class="test-confirm-modal">
    <p class="p">Sure?</p>
  </dialog>
</template>
<style scoped>
.test-confirm-modal {
  &:modal {
    margin: auto;
    inset: 0;
  }
  > .p { color: inherit; }
}
</style>
