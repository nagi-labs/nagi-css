<script setup>
defineProps({ active: Boolean, iconName: String })
</script>

<template>
  <section class="test-component">
    <i :class="iconName" />
    <div :class="{ 'is-active': active }" />
  </section>
</template>

<style scoped>
.test-component div {
  color: red;
}
</style>
