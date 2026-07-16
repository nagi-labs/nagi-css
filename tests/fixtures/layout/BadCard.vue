<template>
  <article class="bad-card">
    <h3 class="title">Hi</h3>
  </article>
</template>
<style scoped>
.bad-card {
  margin: 1rem;
  position: absolute;
  top: 0;
  padding: 1rem;
  > .title { margin: 0; }
  &.-compact {
    margin-inline: 2rem;
  }
}
</style>
