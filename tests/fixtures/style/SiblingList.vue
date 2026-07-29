<template>
  <ul class="test-sibling-list">
    <li class="item">
      <span class="value">a</span>
      <span class="value">b</span>
    </li>
  </ul>
</template>

<style scoped>
.test-sibling-list {
  > .item + .item {
    border-block-start: 1px solid;
  }

  > .item {
    > .value ~ .value {
      margin-inline-start: 0.25rem;
    }
  }
}
</style>
