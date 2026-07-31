<script lang="ts">
  let expanded: boolean = false
</script>

<section class="test-svelte-card" data-expanded={expanded}>
  <h2 class="title">Svelte</h2>
  <button class="button" aria-expanded={expanded}>Toggle</button>
</section>

<style>
  .test-svelte-card {
    > .title {}
    > .button {}
  }
</style>
