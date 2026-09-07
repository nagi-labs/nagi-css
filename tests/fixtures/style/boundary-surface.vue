<template>
  <section class="test-boundary-surface">
    <data-table class="ui-data-table">
      <template #body>
        <div class="ui-data-table-body">
          <column class="ui-column">
            <template #body>
              <div class="ui-table-column-body">
                <p class="p">Value</p>
              </div>
            </template>
          </column>
        </div>
      </template>
    </data-table>
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
