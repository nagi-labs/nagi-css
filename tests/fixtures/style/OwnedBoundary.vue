<template>
  <header class="test-owned-boundary">
    <UserAvatar />
    <div class="unit"><span class="icon" /></div>
  </header>
</template>

<style scoped>
.test-owned-boundary {
  > .test-user-avatar {
    margin-inline-end: var(--space-3);
  }

  > .test-user-avatar:hover {
    opacity: 0.8;
  }

  > .unit {
    > .icon {
      inline-size: 1rem;
    }
  }
}
</style>
