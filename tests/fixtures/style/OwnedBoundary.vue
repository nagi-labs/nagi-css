<template>
  <header class="test-owned-boundary">
    <UserAvatar class="media" />
    <div class="unit"><span class="icon" /></div>
  </header>
</template>

<style scoped>
.test-owned-boundary {
  > .media {
    margin-inline-end: 0.75rem;
  }

  > .media:hover {
    opacity: 0.8;
  }

  > .unit > .icon {
    inline-size: 1rem;
  }
}
</style>
