<template>
  <section class="test-invalid-boundary-surface">
    <DataTable class="ui-data-table">
      <Column class="ui-column">
        <template #body>
          <div class="ui-table-column-body" />
        </template>
      </Column>
    </DataTable>
  </section>
</template>

<style scoped>
.test-invalid-boundary-surface .value {}
.test-invalid-boundary-surface > button {}
.test-invalid-boundary-surface > .ui-data-table .ui-table-column-body {}
.test-invalid-boundary-surface > .ui-data-table .value {}
.test-invalid-boundary-surface > .ui-data-table > .ui-table-column-body {}
.ui-table-column-body {}
.value {}

.test-invalid-boundary-surface {
  > .mystery {}
  > .wrapper {}
  > .is-open {}
  &.alternate-name {}
}
</style>
