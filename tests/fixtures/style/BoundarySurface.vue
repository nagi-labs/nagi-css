<template>
  <section class="test-boundary-surface">
    <DataTable class="ui-data-table">
      <Column class="ui-column">
        <template #body>
          <div class="ui-table-column-body">
            <p class="text">Value</p>
          </div>
        </template>
      </Column>
    </DataTable>
  </section>
</template>

<style scoped>
.test-boundary-surface {
  > .ui-data-table {
    .ui-column {
      .ui-table-column-body {
        > .text {}
        :deep(.third-party-node span) {}
      }
    }
  }
}
</style>
