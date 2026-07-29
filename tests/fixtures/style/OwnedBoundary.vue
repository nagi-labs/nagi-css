<template>
  <header class="test-owned-boundary">
    <UserAvatar />
    <div class="unit"><span class="icon" /></div>
  </header>
</template>

<style scoped>
.test-owned-boundary {
  > .test-user-avatar {
    margin-inline-end: 0.75rem;
  }

  > .test-user-avatar:hover {
    opacity: 0.8;
  }

  > .unit > .icon {
    inline-size: 1rem;
  }
}
</style>
