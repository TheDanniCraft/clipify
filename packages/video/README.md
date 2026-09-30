# Clipify product videos

Local Remotion compositions for product trailers and social exports. This package is intentionally separate from the production Next.js application.

## Commands

Run from `packages/video`:

```sh
bun run studio
bun run audio:generate
bun run render
bun run render:vertical
bun run render:feed
bun run render:upload
bun run render:upload:vertical
bun run render:upload:feed
bun run render:preview
bun run render:preview:vertical
bun run render:preview:feed
bun run thumbnail
bun run thumbnail:vertical
bun run thumbnail:feed
bun run typecheck
```

`bun run render` is the archival master: ProRes 4444, 10-bit 4:4:4, BT.709, lossless PNG intermediate frames, and PCM audio. It is intentionally large and should be kept as the local source-of-truth or uploaded directly when a platform accepts ProRes.

`bun run render:upload` creates a much smaller, high-quality H.264 file for services with upload limits. `bun run render:preview` is the fastest review export and is not a delivery master.

The Clipify Showcase is a 45-second trailer with an original, procedurally generated soundtrack. The WAV file is a build artifact and is intentionally not committed: run `bun run audio:generate` before opening the composition or rendering it. The generator uses mathematical oscillators and deterministic noise only—no stock music, sample packs, loops, recordings, or third-party audio assets.

The trailer has three synchronized compositions that reuse the same scenes, timeline, and generated audio:

- `ClipifyShowcase`: 1920×1080 (16:9) for regular YouTube.
- `ClipifyShowcaseVertical`: 1080×1920 (9:16) for YouTube Shorts and Instagram Reels.
- `ClipifyShowcaseFeed`: 1080×1350 (4:5) for Instagram and LinkedIn feeds.

Composition-only source files and assets are grouped in matching `clipify-showcase` directories under `src/compositions`, `public`, and `scripts`.

See [PRODUCTION_GUIDE.md](./PRODUCTION_GUIDE.md) for package-wide motion and sound rules. Composition-specific story and timing live in each composition's `CUE_SHEET.md`; for the current trailer, see [the Clipify Showcase cue sheet](./src/compositions/clipify-showcase/CUE_SHEET.md).

Rendered files are written to `packages/video/out/` and are not committed. Each format has an archival `*-master.mov`, a high-quality `*-upload.mp4`, and a fast `*-preview.mp4`. Compressed derivatives should always be recreated from the composition or its master, never from another compressed MP4.

The committed source of truth is the composition code, timeline, cue sheet, production guide, soundtrack generator, package configuration, and lockfile. Generated media—including WAV, MP4, MOV, and review stills—remains local or belongs in a release/asset store rather than the Git repository.

The thumbnail commands export frame 1,230 from each composition. This is the settled final celebration state: centered Clipify branding, the campaign claim and CTA, and the scattered community-reaction field. Keeping the still tied to a real composition frame prevents its typography and visual language from drifting away from the trailer.
