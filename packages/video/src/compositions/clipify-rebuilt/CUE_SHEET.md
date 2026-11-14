# Clipify rebuilt — 28.8 seconds, 30 fps, 150 BPM

1920×1080, 16:9 landscape for the product website and YouTube.

The approved MomentsPreview drums, bass riff, synth voices and fills remain the
music source. This version disables the deliberate transition pockets throughout.
Music is a single full-length WAV; scene changes do not restart or trim it.
`timeline.ts` supplies both motion events and sound cue frames.

| Frames  | Product action                                                                         | Sound synchronization                                        |
| ------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 0–95    | Last stream's moments assemble; one clip lifts out                                     | Card clicks at 12/24/36, selection at 60, lift sweep at 72   |
| 96–191  | Clip becomes a vertical export; camera/game/title land; file is ready                  | Landings at 120/126/132, export click 144, success 156       |
| 192–383 | Automatic playback advances; a viewer requests a clip; request enters queue then plays | Next clip 228, redeem 276, queue 288, requested playback 324 |
| 384–527 | Player colors and type change; metadata widget moves                                   | Palette clicks 384/420/456, widget lands 504                 |
| 528–671 | Public gallery assembles; a clip opens for viewing                                     | Cards 540/552, selection 588, playback 600                   |
| 672–719 | Replay / Reuse / Repeat                                                                | Word impacts 672/684/696                                     |
| 720–863 | Official Clipify mark, primary purple and CTA                                          | Logo resolve 720, CTA impact 756                             |

Opaque traveling wipes cover scene boundaries; two headlines never crossfade.
Hero moments use large isolated product elements, explicit input, and visible
results. The existing website's channel captures provide media content; they
are still captures, not newly sourced gameplay footage.

## Asset provenance

- `public/clipify-rebuilt/media/clipify-logo.svg`: exact copy of `src/app/icon.svg`.
- `counter-strike.webp`: copy of website `public/product/broadcast.webp`.
- `minecraft.png`: copy of website `public/landing-playback.png`.
- Primary color: website theme `oklch(48.8% 0.2839 284.35)`.
- Inter variable font: Google Fonts Inter, OFL bundled alongside the font.
- Serif/mono demonstration fonts: existing repository DejaVu fonts.

Previous previews and their approved audio files are preserved.

## Review notes and deliberate choices

Stream length, timestamps and queue counts are illustrative. Feature behavior
follows the existing stream overview, export editor, automatic player, viewer
requests, theme studio and public gallery. Pro features are marked. The names
and imagery come from existing channel captures, not invented testimonials.
Traveling opaque wipes deliberately replace the guide's usual crossfades so
successive headlines cannot double-expose.

The archival ProRes 4444 / PCM master is generated separately with
`bun run rebuilt:master`. The H.264 handoff is rendered directly from Remotion,
never from the half-resolution preview.

## Exact sound schedule

| Frame | Time (s) | Cue     |
| ----- | -------- | ------- |
| 0     | 0.000    | impact  |
| 12    | 0.400    | click   |
| 24    | 0.800    | click   |
| 36    | 1.200    | click   |
| 60    | 2.000    | click   |
| 72    | 2.400    | sweep   |
| 96    | 3.200    | sweep   |
| 120   | 4.000    | click   |
| 126   | 4.200    | impact  |
| 132   | 4.400    | click   |
| 144   | 4.800    | click   |
| 156   | 5.200    | resolve |
| 192   | 6.400    | sweep   |
| 204   | 6.800    | click   |
| 228   | 7.600    | impact  |
| 252   | 8.400    | click   |
| 276   | 9.200    | click   |
| 288   | 9.600    | impact  |
| 324   | 10.800   | impact  |
| 384   | 12.800   | click   |
| 420   | 14.000   | click   |
| 456   | 15.200   | click   |
| 504   | 16.800   | click   |
| 528   | 17.600   | sweep   |
| 540   | 18.000   | click   |
| 552   | 18.400   | click   |
| 588   | 19.600   | click   |
| 600   | 20.000   | impact  |
| 672   | 22.400   | impact  |
| 684   | 22.800   | impact  |
| 696   | 23.200   | impact  |
| 720   | 24.000   | resolve |
| 756   | 25.200   | impact  |
