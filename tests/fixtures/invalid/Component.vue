<script setup>
defineProps({ active: Boolean, iconName: String })
</script>

<template>
  <section class="component">
    <i :class="iconName" />
    <div :class="{ 'is-active': active }" />
  </section>
</template>

<style scoped>
.component div {
  color: red;
}
</style>
