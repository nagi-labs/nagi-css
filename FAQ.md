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

## The STN vocabulary (`stratum`/`region`/`block`/`zone`/`seg`/`fr`/`g`) looks over-engineered.

STN is the piece that closes the contract end to end. The naming flow —
surface root → element table → component table → role → anatomy — leaves
exactly one hole where taste re-enters: a `div` or `span` that no semantic
name fits. Left open, that hole becomes `wrapper`/`inner`/`box`/`container`
— arbitrary and non-reproducible. STN closes it with a name derived
mechanically from depth, so *every* element gets a rule-derived name and the
determinism holds edge to edge.

Used correctly, STN recedes: maximize semantic HTML and most surfaces need
only a few shallow tiers (mostly `zone`). A surface full of coarse STN names
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
selectors are derived from the template's structure, so a rule whose anchor
class no longer exists in the template is mechanically detectable. Dead
weight that a tool can find beats dead weight that hides.

## Why is the linter mandatory rather than optional?

Without enforcement you pay the contract's discipline cost and get none of
its guarantee. The value is not the naming style; it is that conformance is
*verified*. A hand-run, warnings-only setup degrades into the same
consistency-by-discipline problem every convention has. Run the checks in CI
and treat violations as errors.

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
