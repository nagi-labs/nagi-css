# FAQ

## What does Nagi derive, and what does the author choose?

Native mappings, explicit identifying ARIA names and file-derived Surface names
have mechanical grounds. Internal native/ARIA roles are Predefined.
Selecting a Built-in Anatomy or Custom scoped role requires a meaning
decision. Nagi checks that the chosen name is canonical and applicable; a
definition does not prove that the author chose the right meaning.

Internal roles are Predefined, Defined, Unregistered, or Structural. See the
[Contract](CONTRACT.md) and [definition reference](docs/definitions.md).

## Can I use a name before defining it?

Yes. A residual `div.popup` gets an unregistered warning, while its CSS paths,
ownership, state and declarations are still checked. Register a scoped JSON
definition when the meaning is stable. Never add an empty explanation just to
raise coverage. Fixed platform roles still apply: a native button cannot
rename its base to popup.

## Why keep STN?

It expresses an author's structural choice. Use it for a grouping that does not
need a UI part name. Siblings may share a tier and common styles. STN's depth
rules still apply; `fr` means fragment. Zero STN is not a goal.

## Are variants restricted to business language?

No. `button -close`, `input -lower`, and `field -firstname` can all be static
modifiers. A `unit -popup` that really means a popup should use popup as its base.
The distinction is a contextual semantic judgment. Known applicable definitions
can expose misuse; a list of natural-language words cannot decide every case.

## Is data-role an accessibility role?

No. It references a Nagi scoped-role definition. It adds no browser semantics,
focus behavior, or interaction. Native HTML and actual ARIA must remain correct
independently. Never add an HTML `role` token merely to obtain a CSS name.

## Do required roles always render?

Required means a matching declaration per statically analyzable scope instance.
Conditional and loop declarations count, but runtime presence is not guaranteed.
Unresolved slots or dynamic content remain unknown. See
[required declaration checks](docs/definitions.md#required-declaration-checks).

## What does coverage prove?

It counts internal styled template declarations as Predefined, Defined,
Unregistered and Structural. Surface roots, component boundaries, invalid and
unknown nodes are separate. Built-in Anatomy/Custom selection is Defined, while
HTML/explicit ARIA roles are Predefined.
Coverage does not measure human cognitive load, maintenance time, visual
correctness, or accessibility.

## Why not Tailwind, StyleX, Panda or CSS Modules?

Those approaches have different guarantees and tradeoffs. Nagi checks names,
owned DOM paths and component CSS using explicit definitions. Local scoping or
property composition does not replace that contract; Nagi does not replace
their styling APIs either. Keep comparisons scoped to documented behavior.

## Can I use Sass, utilities or standalone CSS?

The plain backend analyzes component-owned CSS blocks. SCSS and external style
sources are reported as unsupported instead of silently passing. The experimental
`tailwind-apply` backend permits static utility expansion in style blocks,
with reduced declaration visibility; it does not allow utility classes in
owned markup. Global standalone CSS is outside component ownership analysis.

## Where do design values and state live?

Runtime state lives in native, ARIA or data attributes. Colors and repeated scale
values use semantic tokens. Nagi ships token names, not theme values. Component
geometry may remain ordinary CSS, and genuine local non-color scale exceptions
use named local custom properties. See [CSS reference](docs/css-reference.md).

## Does the linter remove unused CSS and fix names automatically?

It reports dead owned classes and impossible selector paths where analysis is
certain. Unknown runtime DOM is not proved dead. Autofix applies only grounded
changes and withholds class renames that would leave CSS stale. Meaning, ARIA
and missing UI parts require explicit edits.
