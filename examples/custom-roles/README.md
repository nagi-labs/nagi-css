# Custom role naming example

Run from the repository root after `vp install --frozen-lockfile`:

```sh
vp run check check --config examples/custom-roles/nagi.config.mjs --cwd .
vp run check measure --config examples/custom-roles/nagi.config.mjs --cwd . --json
```

These Vue, Svelte and Astro files illustrate scoped roles and CSS ownership;
they are not functioning range sliders. `data-role` adds no ARIA behavior.
The JSON lives in an independent definitions directory and all three frameworks
use exactly that definition. Track and fill are Custom Defined, `text` is
Built-in Anatomy Defined, and slider is Predefined through its standard ARIA role.

Each file has P=1, D=3, U=0, T=0, N=4. Across all three:
P=3, D=9, U=0, T=0, N=12. Definition coverage is 12/12 (100.0%): the
three ARIA sliders are Predefined; `text` contributes three Built-in Anatomy
Defined occurrences; and `track`/`fill` contribute six Custom Defined occurrences.
The three surface roots are separate. These counts describe template declarations,
not rendered instances or a quality score.

Remove fill to reproduce `required-role-missing`. Move a `range/fill` declaration
inside another scope root to reproduce `scoped-role-context`. Use an unregistered
`.popup` to see a warning while its CSS is still checked.
