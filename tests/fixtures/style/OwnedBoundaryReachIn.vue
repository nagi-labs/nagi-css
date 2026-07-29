<template>
  <header class="test-owned-boundary-reach-in">
    <UserAvatar class="media" />
  </header>
</template>

<style scoped>
.test-owned-boundary-reach-in {
  > .media > .icon {
    inline-size: 2rem;
  }

  > .media {
    .icon {
      inline-size: 2rem;
    }
  }
}
</style>
