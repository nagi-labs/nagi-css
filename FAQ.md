# FAQ

Objections we expect, answered up front. The recurring theme: Nagi CSS trades
writing convenience for a **canonical, machine-checkable form**. Most
criticisms below are real costs — and each one is the price of that trade.

## Why not Tailwind?

Tailwind is optimized for *writing*: appearance is local to the element and
unconstrained. Nagi CSS is optimized for *reading, reviewing, and
maintaining*: names carry meaning and structure is verifiable.

The decisive difference is **canonical form**. Under Nagi CSS, the correct
class for a node is *unique* — derived from the configured prefix and file name, the element and
component tables, anatomy, or the STN ladder. A linter can therefore enforce
it, and any two authors (human or AI) converge on the same output. Tailwind
has no canonical form: many utility combinations produce the same look, and
"is this the idiomatic, consistent one?" is not machine-decidable. Working
Tailwind is easy to produce; *consistent* Tailwind remains a discipline
problem forever.

Two follow-on effects favor the contract:

- **Diffs.** A style change here is a changed property in a named rule. In
  utility CSS it is one mutated token inside a long class string — hard to
  review for humans and models alike.
- **Cruft.** Utility CSS avoids orphaned stylesheet rules but accumulates
  dead and conflicting utilities on elements (`p-4 p-2`, a leftover `flex`),
  invisibly, per element. Without a canonical form, nobody notices.

Tailwind's genuine intrinsic win is local appearance comprehension — "how
does this look" answered inline. If that is what you optimize for, Tailwind
is a fine choice. Nagi CSS bets on the other axis.

## Isn't this just BEM with extra steps?

BEM is a naming *convention*: it tells you how to format a name you already
chose, and nothing checks the choice. Nagi CSS is a *contract*: the name
itself is derived — surface roots from configured prefixes and file names, fixed classes from
element/component tables, structural names from the STN ladder — and every
derivation is lint-enforced, including things naming conventions never touch:
ownership edges (`>`), UI-library boundaries, slot sub-surfaces, teleported
surfaces, and attribute-based state.

## The STN vocabulary (`stratum`/`region`/`block`/`unit`/`seg`/`fr`/`g`) looks over-engineered.

STN is the piece that closes the contract end to end. The naming flow —
surface root → element table → component table → role → anatomy — leaves
exactly one hole where taste re-enters: a `div` or `span` that no semantic
name fits. Left open, that hole becomes `wrapper`/`inner`/`box`/`container`
— arbitrary and non-reproducible. STN closes it with a name derived
mechanically from depth, so *every* element gets a rule-derived name and the
determinism holds edge to edge.

Used correctly, STN recedes: maximize semantic HTML and most surfaces need
only a few shallow tiers (mostly `unit`). A surface full of coarse STN names
is the contract telling you the component is too deep and should be split —
a smell detector, not a naming style to lean on.

The honest costs — unfamiliar vocabulary, no prior art, sometimes wanting a
meaning-name where a depth tier is required — are the bounded price of
removing the last bit of judgment from naming.

## Doesn't Vue scoped CSS already solve this?

Scoped CSS solves *leakage*, not *structure*. Inside a scoped block you can
still write flattened selectors, style library internals, name things
`wrapper`, and encode state in classes. Nagi CSS operates within scoped (or
plain) style blocks and constrains what the selectors and names may be.

## Styles are no longer local to the element. Isn't co-location strictly better?

Non-locality is a real, intrinsic cost — answering "how does this element
look" requires the style block. The contract keeps the cost bounded: the
element's static class names its rule exactly, and `>` nesting mirrors the
template, so the lookup is mechanical rather than a search. What you get in
exchange is meaning in the source: `<section class="section -infra">`
self-documents in a way no utility string can.

## Semantic CSS accumulates dead rules.

It can, and utility CSS is often praised for avoiding that. But the cruft
does not disappear under utilities — it moves into the markup as dead and
conflicting tokens on elements, scattered and unnoticeable. Under Nagi CSS,
selectors are derived from the template's structure, so the linter walks the
owned tree and reports a rule whose anchor class no longer exists (`dead-rule`)
or whose path no longer does (`selector-mirrors-template`). Dead
weight that a tool can find beats dead weight that hides.

## Why is the linter mandatory rather than optional?

Without enforcement you pay the contract's discipline cost and get none of
its guarantee. The value is not the naming style; it is that conformance is
*verified*. A hand-run, warnings-only setup degrades into the same
consistency-by-discipline problem every convention has. Run the checks in CI
and treat violations as errors.

Per-rule `severity` exists for one reason: adopting the contract in a codebase
that predates it, where every rule at `error` on day one means thousands of
failures and no adoption at all. Stage it with `warn`, then move rules to
`error` as they go green. A project that stops halfway has bought the discipline
cost and skipped the guarantee.

One category is a warning by default, and stays one: rules that report what the
toolchain **could not verify** rather than something wrong. A class binding whose
names are assembled at runtime (`:class="iconName"`) is very likely correct — the
honest statement is "this element was not checked", not "this element is broken".
Those reports tell you where the linter is blind so you can decide: rewrite the
binding so the names are readable, accept the gap, or raise the rule to `error`
if the guarantee matters more than the convenience.

## What does this do for accessibility?

Nothing directly — and that is deliberate framing. Accessibility comes from
HTML semantics, ARIA, and focus/keyboard behavior, not from any CSS
strategy. Nagi CSS is a11y-*aligned* rather than a11y-providing: it pushes
you toward semantic elements (reserved HTML names, anatomy vocabulary) and
represents runtime state as native, ARIA, or `data-*` attributes, which is
where assistive technology already looks. Pair it with an accessible
component library; the contract treats that library as an opaque boundary
and never reaches into its DOM.

## Can I mix Nagi CSS with a utility framework?

The contract governs owned structural styling: surfaces, ownership edges,
library boundaries, state. Its core idea — semantic HTML plus classes that
name *what a thing is* — is orthogonal to utilities, and configured
library-owned utility or icon classes may remain dynamic additions to a
static anchor. But the required vocabulary (surface, fixed, anatomy, STN,
slot classes) must stay intact; a hybrid where utilities replace owned
structure forfeits the canonical form that makes the contract checkable.

## Can I write my styles in Sass/SCSS?

No — style blocks are plain CSS. This is not a gap waiting to be filled: native
CSS absorbed the reasons a preprocessor existed (nesting, variables, color
functions, math), and its versions are better for this contract, because custom
properties are live at runtime while `$` variables are compile-time constants.
What is left that only a preprocessor does, this contract either forbids or
cannot verify: `&__title` concatenation produces the BEM name the contract
rejects, `@each` generates the standalone utilities it bans, and `@extend` or a
selector-emitting `@mixin` hides selectors from the linter — which would mean
shipping a supported way to bypass the checks. Migrating an SFC's style block is
mostly mechanical, since the nesting itself is compatible.

## Why aren't standalone `.css` files checked?

Because there is nothing there that the contract governs. Global stylesheets
hold resets, element defaults, token declarations, and cross-surface exceptions
— by definition not the owned DOM of a styling surface. The unit the contract
verifies is a component: its template and its own style block, checked together.

## Why doesn't Nagi CSS ship design tokens?

Because a naming contract and a palette are two different products. Which colors
and spacing steps exist, and what they are called, depends on the design system —
and a project already using Open Props, Radix Colors, or its own scale should not
have to abandon it to get class-name checking.

What it does check is the boundary, and two parts of that need no configuration at
all, because they ask only that a token is used rather than which one.

Colors are the strict part: `#f0a` in a surface is an error whatever the token set
looks like, because a color is never a local decision — it belongs to a palette, it
moves with a theme, and the same hex in twenty surfaces is twenty places to edit.

Lengths are checked only where a design system actually publishes a scale —
spacing, radius, border width, type size, elevation. Here a one-off is legitimate,
so the rule asks for a name instead of a token: `--local-optical-nudge: -1px` keeps
the value and adds the reason. A surface's own width is not on that list, since no
design system ships a scale of content widths.

The rest needs the project to point at the files that declare its tokens: that a
referenced custom property is actually declared somewhere, and that it comes from
the semantic layer rather than the raw palette.
The first is worth an error because CSS fails silently — `var(--color-surfce)`
leaves the property unset with nothing to notice, in a diff that looks fine. The
second is what keeps a theme change inside the token files instead of scattered
across surfaces.

Those two stay off until `tokens.sources` names a file, so nothing is imposed on a
project without a token layer.

## Why invent a new vocabulary instead of reusing an existing one?

Because no existing vocabulary was built to be *derived*. Existing systems
(BEM blocks, SMACSS categories, ITCSS layers) classify names a human picks.
Nagi CSS needs names a machine can validate as the unique correct answer,
which requires fixed tables and a fixed ladder. Unfamiliarity is a one-time
learning cost; non-determinism is a permanent tax.

## Is this for AI agents or for humans?

Both, but the design center is honest: the contract's properties —
canonical form, machine verification, meaning preserved in source, readable
diffs — are exactly the properties that let a model (or a reviewer) maintain
a codebase it did not write. The repository ships an agent skill
(`skills/nagi-css`) that applies the contract, and the CLI verifies the
output regardless of who wrote it.
