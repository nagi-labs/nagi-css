<template>
  <div class="app-price-range" data-role="range/root">
    <span class="text">Illustrative range</span>
    <div class="track" data-role="range/track">
      <div class="fill" data-role="range/fill"></div>
      <div class="slider" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" tabindex="0"></div>
    </div>
  </div>
</template>

<style scoped>
.app-price-range {
  > .text { color: var(--color-text); }
  > .track {
    > .fill { display: block; }
    > .slider { display: block; }
  }
}
</style>
