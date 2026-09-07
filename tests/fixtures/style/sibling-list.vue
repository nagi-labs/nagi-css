<template>
  <ul class="test-sibling-list">
    <li class="item">
      <span class="value">a</span>
      <span class="value">b</span>
    </li>
    <li class="item">
      <span class="value">c</span>
      <span class="value">d</span>
    </li>
  </ul>
</template>

<style scoped>
.test-sibling-list {
  > .item + .item {
    border-block-start: var(--border-hairline) solid;
  }

  > .item {
    > .value ~ .value {
      margin-inline-start: var(--space-1);
    }
  }
}
</style>
