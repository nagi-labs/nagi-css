<template>
  <article class="app-user-card">
    <header class="header">
      <h2 class="title">Profile</h2>
    </header>
    <div class="unit">
      <span class="text">Ada Lovelace</span>
    </div>
    <user-avatar />
  </article>
</template>

<style scoped>
.app-user-card {
  > .header {
    > .title { margin: 0; }
  }
  > .unit {
    > .text { color: var(--color-text); }
  }
  > .app-user-avatar { align-self: center; }
}
</style>
