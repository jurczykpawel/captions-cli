# Caption style packs

Three tiers for the **HF engine** (the only engine). A caption look is parametric —
an animation style × a highlight mode × free colours/size — so a small set of building
blocks yields many looks with little code.

| Tier | What | How to unlock |
|------|------|---------------|
| **Free** | `text` — plain white captions, no word-timing highlight. Ships in source + the public image. | open |
| **Basic** | A handful of word-timing styles (e.g. `box-highlight`, `pill`). | free — confirm your email on the [Sellf free product](https://sellf.techskills.academy) → license token |
| **Premium** | The full catalogue (glow, hormozi, outline-pop, single-word, underline-sweep, pop-word, paper-cutout, hype, …). | one-time purchase on Sellf → license token |

## Licensing

Unlock is one mechanism everywhere: a **Sellf-issued license token** whose `tier` claim
(`basic` / `premium`) decides what's unlocked. The web app verifies it offline against
Sellf's JWKS; the CLI pack download is gated the same way. No keys are minted or stored by
us — the token is the entitlement. See `apps/web/functions/_lib/sellf-license.ts`.

## Preset source & build

- Free preset (`text.ts`) lives in source control. Basic + premium `.ts` files live in
  gitignored `packs/hf/{basic,premium}/` and are installed into `engine-hf/src/presets/`
  at build time by `scripts/install-pack.sh <free|basic|premium>`.
- Each preset is a `(PresetInput) => { css, timelineJs? }` builder over the
  `.word--past/active/upcoming` contract — the same format the web app and ReelStack consume.
- The shared catalogue is authored in `reelstack-modules` (premium) + `@reelstack/core`
  (free + parametric model); captions consumes the HF/CSS side of it.
