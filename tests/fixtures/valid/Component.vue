<script setup>
defineProps({ active: Boolean, iconName: String })
</script>

<template>
  <section class="test-component">
    <span class="icon" :class="iconName" />
    <div class="value" :data-active="active" />
  </section>
</template>

<style scoped>
.test-component {
  > .icon {}
  > .value {}
}
</style>
