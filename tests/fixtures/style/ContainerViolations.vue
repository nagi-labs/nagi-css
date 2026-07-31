<template>
  <article class="test-container-violations">
    <div class="media"><span class="icon" /></div>
  </article>
</template>

<style scoped>
.test-container-violations {
  container: card / inline-size;

  > .media {
    container-name: media-box;

    @container app-page-main (min-inline-size: 20rem) {
      > .icon { opacity: 1; }
    }
  }
}
</style>
