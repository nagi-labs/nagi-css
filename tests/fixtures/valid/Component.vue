<script setup>
defineProps({ active: Boolean, iconName: String })
</script>

<template>
  <section class="component">
    <i class="icon" :class="iconName" />
    <div class="value" :data-active="active" />
  </section>
</template>

<style scoped>
.component {
  > .icon {}
  > .value {}
}
</style>
