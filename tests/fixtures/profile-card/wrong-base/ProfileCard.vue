<template>
  <article class="test-user-card">
    <header class="header">
      <h2 class="title">Profile</h2>
    </header>
    <div class="unit">
      <span class="text">Ada Lovelace</span>
    </div>
    <UserAvatar />
  </article>
</template>

<style scoped>
.test-user-card {
  > .header {
    > .title { margin: 0; }
  }
  > .unit {
    > .text { color: var(--color-text); }
  }
  > .test-user-avatar { align-self: center; }
}
</style>
