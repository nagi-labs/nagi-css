<template>
  <section class="test-separator-list">
    <ul class="list">
      <li class="item" role="separator" />
    </ul>
    <div class="separator" role="separator" />
  </section>
</template>

<style scoped>
.test-separator-list {
  > .list {
    > .item[role="separator"] {}
  }
  > .separator {}
}
</style>
