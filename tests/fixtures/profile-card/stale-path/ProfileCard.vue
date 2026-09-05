<template>
  <article class="test-profile-card">
    <header class="header">
      <h2 class="title">Profile</h2>
      <div class="unit">
        <span class="text">Ada Lovelace</span>
      </div>
    </header>
  </article>
</template>

<style scoped>
.test-profile-card {
  > .header {
    > .title {
      > .text { color: var(--color-text); }
    }
  }
}
</style>
