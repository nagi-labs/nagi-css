<script setup>
import { computed, ref } from "vue"

const bold = ref(false)
const italic = ref(false)

const statusMessage = computed(() => {
  const activeFormats = [bold.value && "Bold", italic.value && "Italic"].filter(Boolean)
  return activeFormats.length > 0
    ? `Active formatting: ${activeFormats.join(" and ")}.`
    : "No formatting is active."
})

function toggleBold() {
  bold.value = !bold.value
}

function toggleItalic() {
  italic.value = !italic.value
}
</script>

<template>
  <section class="app-format-controls">
    <h2 class="title">Text formatting</h2>

    <div class="unit">
      <span class="text">Apply to the current selection</span>

      <div class="group" role="group" aria-label="Text formatting">
        <button
          class="button"
          type="button"
          :aria-pressed="bold"
          @click="toggleBold"
        >
          Bold
        </button>

        <button
          class="button"
          type="button"
          :aria-pressed="italic"
          @click="toggleItalic"
        >
          Italic
        </button>
      </div>

      <span class="status" role="status" aria-atomic="true">
        {{ statusMessage }}
      </span>
    </div>
  </section>
</template>

<style scoped>
.app-format-controls {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6);
  color: var(--color-text);
  background: var(--color-surface);
  border: var(--border-width-1) solid var(--color-border);
  border-radius: var(--radius-2);
  box-shadow: var(--shadow-1);

  > .title {
    margin: 0;
    font-size: var(--font-size-3);
    line-height: 1.2;
  }

  > .unit {
    display: grid;
    gap: var(--space-4);

    > .text {
      color: var(--color-text-muted);
      font-size: var(--font-size-1);
    }

    > .group {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);

      > .button {
        min-inline-size: 6rem;
        padding: var(--space-3) var(--space-4);
        color: var(--color-text);
        font: inherit;
        font-weight: 650;
        background: var(--color-surface);
        border: var(--border-width-1) solid var(--color-border);
        border-radius: var(--radius-1);
        cursor: pointer;

        &:hover {
          border-color: var(--color-accent);
        }

        &:focus-visible {
          outline: var(--border-width-2) solid var(--color-accent);
          outline-offset: var(--space-1);
        }

        &[aria-pressed="true"] {
          color: var(--color-accent-text);
          background: var(--color-accent);
          border-color: var(--color-accent);
        }
      }
    }

    > .status {
      min-block-size: 1.5em;
      color: var(--color-text-muted);
      font-size: var(--font-size-1);
    }
  }
}
</style>
