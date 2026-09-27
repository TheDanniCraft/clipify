# Video package instructions

These instructions apply to all work in `packages/video`.

1. Read [`PRODUCTION_GUIDE.md`](./PRODUCTION_GUIDE.md) before creating or editing a composition.
2. Read the target composition's `CUE_SHEET.md`. For a new composition, create the cue sheet before the final render.
3. Keep generic production rules in the package guide and campaign-specific decisions in the composition cue sheet.
4. Put shared event frames in the composition's `timeline.ts`. Import those constants from both visual code and soundtrack generation; do not duplicate rounded timestamps.
5. Every audible cue must correspond to a visible event documented in the cue sheet.
6. Use real JSX/HTML for text and existing package dependencies for icons and UI primitives.
7. Keep composition-only source, scripts, assets, and documentation in matching composition folders.
8. Before handoff, regenerate audio, run type checking, render the full video, inspect scene boundaries, and verify the exported media streams.

## Graphify context routing

- Treat `packages/video/graphify-out` as the authoritative graph for compositions, campaign structure, motion, sound, and rendering.
- Treat the repository-root `graphify-out` as the authoritative graph for Clipify product behavior and application features.
- For an existing video composition, query the package graph first.
- Before planning a video or mockup for an application feature, also query the root graph for that product concept (for example, Member Card), then inspect only the source files returned by that query.
- Prefer exact root-graph symbol vocabulary when a plain-language query is sparse. For example, query `MemberCard memberCardImage memberCardLinks` instead of only `member card`.
- Run each query from the graph's owning directory. Graphify resolves `graphify-out` relative to the current working directory and does not automatically query parent graphs.
- Keep the two committed graphs separate. Never merge or regenerate the root graph as part of package-only video work.

Repository-level instructions still apply, including Git signing and hook requirements.
