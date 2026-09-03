<template>
  <section class="test-boundary-surface">
    <DataTable class="ui-data-table">
      <template #body>
        <div class="ui-data-table-body">
          <Column class="ui-column">
            <template #body>
              <div class="ui-table-column-body">
                <p class="p">Value</p>
              </div>
            </template>
          </Column>
        </div>
      </template>
    </DataTable>
  </section>
</template>

<style scoped>
.test-boundary-surface {
  > .ui-data-table {
    .ui-data-table-body {
      > .ui-column {
        .ui-table-column-body {
          > .p {}
          :deep(.third-party-node span) {}
        }
      }
    }
  }
}
</style>
