# Component Library Boundaries

Use this when a Styling Surface uses component libraries, named slots, portals, or shadow DOM.

## Rule

Do not treat a third-party component wrapper, its named slots, and the markup you place inside those slots as one direct owned DOM tree.

Classify each layer first:

- Owned DOM rendered directly by your component.
- Third-party component root exposed through public props, classes, pass-through APIs, or CSS variables.
- Third-party internals, which are non-owned.
- Slot content you author, which may be owned by your component but is separated by the slot boundary.
- Portal or shadow DOM, which is non-owned unless the owner exposes a public styling contract.

## Component Library Pattern

Bad:

```vue
<Card class="procedure-section">
  <template #title>
    <header class="header">
      <h2 class="title">Procedure</h2>
    </header>
  </template>
</Card>

<style scoped>
.procedure-section {
  > .header {
    display: flex;
  }
}
</style>
```

Problems:

- `Card` is a third-party component, not the owned DOM surface. Its root class is the configured boundary class (`pv-card`), never a surface identity.
- The `title` slot is a boundary.
- `.header` is authored by this component, but it is not a guaranteed direct child of the component root.
- The selector relies on third-party component rendering structure.

Good:

```vue
<Card>
  <template #title>
    <header class="card-title">
      <h2 class="title">Procedure</h2>
    </header>
  </template>

  <template #content>
    <div class="card-content">
      ...
    </div>
  </template>

  <template #footer>
    <footer class="card-footer">
      ...
    </footer>
  </template>
</Card>
```

Each styled slot receives the **declared sub-surface class** from the
`componentSlots` configuration (`Card: { title: "card-title", content:
"card-content", footer: "card-footer" }`). The wrapper you author inside the
slot carries that class and is its own styling surface: internal names such as
`title`, `button`, or `icon` belong to that local surface, and its children
nest with `>`. Do not invent a bespoke surface name per use site; distinguish
multiple instances or domain meaning with a variant (`card-content -address`).

In CSS, place the slot surface under the nearest owned parent surface when it remains in the same rendered DOM subtree. Use `>` from owned DOM to the UI library boundary class, use a descendant step from that boundary to the declared slot surface, then resume `>` inside the slot surface.

The boundary root may be styled directly for external layout. A selector that
continues below it must first reach a slot surface declared for that exact
component. A different component root or a library-internal class is not an
owned-content anchor; use `:deep()` only for an intentional non-owned
adjustment exposed by the library.

```css
.procedure-page {
  > .pv-card .card-content {
    > .field { ... }
  }
}
```

If the slot content is teleported or otherwise detached from the parent surface, keep the slot surface top-level and declare it in `detachedSlotSurfaces` — the linter rejects a top-level slot surface that is not explicitly configured as detached.

Also valid when an outer owned layout element is needed:

```vue
<section class="section -procedure">
  <Card>
    ...
  </Card>
</section>
```

Use the outer element for owned external layout only, and name it by the normal naming flow (element table, anatomy, or STN — or the surface root when it is the template root). Do not write CSS that assumes the outer element owns the component library internals or slot insertion structure.

## Naming

Slot sub-surface classes are fixed by the `componentSlots` configuration and start with the owning component's slot prefix. Domain meaning goes in the surface identity of the file or in a variant on the slot surface — never in a bespoke slot-surface name invented at the use site.

**Only wrap and declare a slot sub-surface when you actually style that slot's content.** If the library's slot already lays the content out and you add no owned styles, leave it unwrapped; an unstyled wrapper displaces the library's own layout for no benefit.

## Review Checklist

- Does a surface class live on a third-party component while CSS targets markup inside its slots?
- Does any selector cross a third-party internal structure or named slot insertion boundary?
- Does any `>` selector depend on DOM that the third-party component renders?
- Are styled slot contents carried by declared `componentSlots` sub-surfaces?
- Are third-party styles applied through public contracts such as props, pass-through APIs, CSS variables, or documented classes?
