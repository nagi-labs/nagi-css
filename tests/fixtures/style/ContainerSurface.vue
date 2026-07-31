<template>
  <article class="test-container-surface">
    <div class="media"><span class="icon" /></div>
  </article>
</template>

<style scoped>
.test-container-surface {
  container: test-container-surface / inline-size;

  > .media {
    container-name: test-container-surface-media;
    container-type: inline-size;

    @container test-container-surface-media (min-inline-size: 20rem) {
      > .icon { opacity: 1; }
    }
  }

  @container (min-inline-size: 30rem) {
    > .media { opacity: 1; }
  }
}
</style>
