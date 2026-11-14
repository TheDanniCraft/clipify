# Clipify product videos

Local Remotion compositions for product trailers and social exports. This package is intentionally separate from the production Next.js application.

Before rendering Flow or Rebuilt from a fresh checkout, run `bun run fonts:prepare`.
It copies the existing repository's DejaVu fonts and downloads the pinned,
checksum-verified Inter font. Render font binaries are ignored rather than
duplicated in Git; their license notices remain beside the generated assets.

The approved connected **Clipify Flow** trailer now has matching social layouts:

| Composition           | Frame           | Commands                                       |
| --------------------- | --------------- | ---------------------------------------------- |
| `ClipifyFlow`         | 1920×1080, 16:9 | `flow:render`, `flow:master`                   |
| `ClipifyFlowVertical` | 1080×1920, 9:16 | `flow:render:vertical`, `flow:master:vertical` |
| `ClipifyFlowFeed`     | 1080×1350, 4:5  | `flow:render:feed`, `flow:master:feed`         |

All are 30.8 seconds at 30 fps and share the approved music and action timeline.
Social formats reflow the actual components. They do not crop a landscape MP4.
Run `flow:audio` once before rendering. `flow:preview:vertical` / `flow:preview:feed`
produce iteration renders, and `flow:thumbnail:vertical` / `flow:thumbnail:feed`
export the settled end screen at frame 900. Final files are
`out/clipify-flow-vertical.mp4` and `out/clipify-flow-feed.mp4`, with separate
`*-master.mov` files. Format geometry is isolated in the Flow composition's
`layout.ts`.

After rendering the landscape and both social MP4s and masters, run
`bun run flow:review:social`. It verifies dimensions, frame count, codecs,
uninterrupted audio and decoded audio equality with the approved landscape,
then exports review frames, contact sheets and full-resolution thumbnails.

The Flow grid uses one width-derived pixel length for both axes in every format.
It is fixed at the composition root and does not scale with moving scene panels.
At equal displayed width, its cells and strokes have the same apparent size.
`python3 scripts/clipify-flow/check-grid.py` measures actual PNG pixel spacing
on both axes (requires Python's standard library plus FFmpeg/FFprobe only).
Use `--images-dir` and `--report` to check native frames extracted from MP4s too.
The final three-format handoff and thumbnails are in `out/clipify-final-end-screen/`.

## Clipify Flow

`ClipifyFlow` is the current connected 30.8-second trailer. It uses actual moving
Twitch clips from thedannicraft, staggered character typography, the OG image's
purple/grid environment, and continuous product objects: stream moment → crop
transfer → export → next-stream automatic playback → theme changes → closing
player. It preserves the approved music through 28 seconds and extends the same score through the end screen and changes the
action effects. Earlier compositions remain available.

From this directory:

```sh
bun scripts/clipify-flow/fetch-media.mjs
bun run flow:audio
bun run typecheck
bun run flow:preview
bun run flow:render
bun run flow:master
```

`out/clipify-flow.mp4` is the 1080p H.264 handoff;
`out/clipify-flow-master.mov` is the separate ProRes 4444 / PCM archive.
Downloaded source videos and generated audio are ignored build assets. Public
clip URLs and creator attribution live in
`public/clipify-flow/media/sources.json`; no signed playback URLs are committed.
The [cue sheet](./src/compositions/clipify-flow/CUE_SHEET.md) documents the
connected actions, crop geometry, media-clock continuity and review requirements.

## Rebuilt product trailer

`ClipifyRebuilt` is an earlier 28.8-second, 1080p cut. It centers animated product
actions: stream moment → vertical export → automatic playback and viewer queue →
theme editing → website gallery. It uses the official SVG logo, the website's
primary purple, and the approved audition's procedural music without transition
pockets. Channel imagery comes from existing website captures.

Run `bun run rebuilt:audio`, then `bun run rebuilt:render`. Deliverable:
`out/clipify-rebuilt.mp4`. `bun run rebuilt:preview` produces a half-resolution
review copy; `bun run rebuilt:master` produces a ProRes 4444 / PCM archive.
[The cue sheet](./src/compositions/clipify-rebuilt/CUE_SHEET.md)
records action frames, audio synchronization and asset sources.

## Clipify Pulse

`ClipifyPulse` is the fast 24.5-second product trailer. It uses kinetic typography, current Clipify product captures, and an original drum-and-bass-led procedural score. The composition is 1920×1080 at 30 FPS.

```sh
bun run pulse:audio
bun run pulse:render:preview
bun run pulse:render:upload
bun run pulse:render
bun run pulse:thumbnail
```

The preview is for review only, the upload export is the high-quality H.264 deliverable, and the ProRes render is the archival master. Campaign timing and cue decisions live in [`src/compositions/clipify-pulse/CUE_SHEET.md`](./src/compositions/clipify-pulse/CUE_SHEET.md).

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

## Moments music and motion audition

`MomentsPreview` is a 12.8-second, 150 BPM creative preview of stream overview → clip preview → Desktop/Mobile composition → export. It uses animated React/SVG product mockups and illustrative demo media. It is not a distribution master.

Run `bun run moments:audio`, then `bun run moments:preview`. The video is `out/moments-music-motion-preview.mp4`; a separate music-only listen is generated at `public/moments-preview/audio/music-only.wav`. Both audio files are original deterministic synthesis, with no reference soundtrack samples. The exact action cues live in `src/compositions/moments-preview/timeline.ts` and its `CUE_SHEET.md`.

## Your last stream — full rough cut

`MomentsTrailer` extends the approved musical direction into a 32-second narrative: thumbnail stream timeline → one moment → export / overlay playback and viewer request / customization / website gallery → three-use payoff. Run `bun run moments:trailer:audio` then `bun run moments:trailer:preview`. Review output: `out/your-last-stream-rough-cut.mp4`.

The composition and action timeline live under `src/compositions/moments-trailer`. The score generator reuses the audition's synthesis engine, with a full-length arrangement and its own cue list/output directory. The earlier audition is preserved. SVG media is still illustrative placeholder content; this is a rough animatic for story, motion, and audio review, not a final publication master.
