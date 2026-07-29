<template>
  <header class="test-owned-boundary-reach-in">
    <UserAvatar />
  </header>
</template>

<style scoped>
.test-owned-boundary-reach-in {
  > .test-user-avatar > .icon {
    inline-size: 2rem;
  }

  > .test-user-avatar {
    .icon {
      inline-size: 2rem;
    }
  }
}
</style>
