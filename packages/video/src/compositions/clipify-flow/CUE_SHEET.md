# Clipify Flow — connected product trailer

1920×1080, 30 fps, 924 frames / 30.8 seconds. Website / landscape social.

## End screen

The current CS2 and Minecraft clips stay in place. Frames 840–863 crossfade
the product view into a centered official Clipify logo and character-built
“Keep your stream alive.” (one line in landscape, two in social). The same width-normalized square grid
continues behind both. Frames 864–923 hold the fully settled end screen for
two seconds, with plain “Get started for free at / clipify.us” beneath it.
There is no button or extra logo stinger. A quiet resolve at frame 864 marks
the completed end-screen reveal.

Audio preserves the approved PCM body exactly through frame 839. Frames
840–851 blend into a phase-aligned continuation of the same synthesized score,
before the original fade-out, and the score continues to the new ending.
The approved 28.8s sources are `approved-mix.wav` / `approved-music-only.wav`.
End-screen thumbnails use frame 900 in all three formats.

## Social formats

The approved landscape cut also ships as `ClipifyFlowVertical` (1080×1920,
9:16) and `ClipifyFlowFeed` (1080×1350, 4:5). All three use this exact timeline,
copy, music mix, source-video clocks and scene components. `layout.ts` owns
format geometry; social CSS is scoped to its format. The approved story and
timing are shared while card geometry can be refined per format.

All formats share a width-derived square grid: cell=48×width/1080 pixels,
stroke=width/1080 pixels, half-cell offset, opacity=0.65. Both grid axes use
the same pixel length, independent of frame height. Thus landscape cells are
85⅓px square and social cells 48px square; all appear 24px square when shown
at 540px width. Native exported frames are measured on both axes and compared
side by side at equal displayed width before handoff.

The final CTA is plain editorial text: “Get started for free at”, followed by
prominent `clipify.us`. It has no pill, border, shadow or external-link icon,
since an embedded video CTA cannot be clicked. Buttons inside the product demo
still explain the demonstrated product interactions.

Video elements derive height from intrinsic 16:9
aspect ratio; crop positioning changes the viewport, never independent x/y
scaling. Review compares rendered interior patches against source frames.

Automatic-selection panels and preview slots share one geometry definition.
The inset is 31px including the border. Landscape previews fill the content
width; the social cards use a right column, aligned with their status text.
Both card and preview share entrance opacity/translation. Preview borders are
thin and shadows stay compact so the preview fits inside the larger card.

At frames 360–368, queue thumbnails leave their card at their existing size:
landscape exits left, social exits upward. Frames 368–384 expand clear of the
card text, with a fixed right edge in landscape and a fixed bottom edge in
social. Status copy fades during the transfer and returns after landing.
Vertical filters and divider occupy the left column, leaving the preview's
right-hand route clear. Footer properties are plain “Color”, “Type”, “Position”
labels; the status line has no detached six-dot grip icon.

Vertical keeps the hook above the playing clip, stacks the source and facecam /
gameplay mobile output, places automatic-playback controls below the player,
and lays the three template previews in a row below the customization canvas.
Its overview is a vertical rail at x=96 with branches to two stacked moment
cards. Rail markers share the cards' vertical centers, so each moment has a
visible place in the stream's sequence. The closing player stays near its
playback position; the CTA sits below the video.

Feed keeps the primary media center at y=713.125 throughout intro, overview,
export, playback, customization and close. Overview cards share that baseline;
only selection/export changes their scale. The normal 900px player stays at
y=460, including the end card. This removes the former intro/playback/closing
height jumps. Feed headlines use a compact single line, while vertical copy
breaks at complete phrases. Feed's CTA fits above the player, with supporting
copy and URL below it. Pointer targets derive from each format's geometry,
including scaled metadata drag coordinates.

Vertical branding starts below the top 140px; core content uses x=72–972 with
room on the right and bottom for social controls. These are editorial margins,
not a guarantee for every platform placement. Export each format directly from the composition
as H.264/AAC and a separate ProRes 4444/PCM master; thumbnails use frame 900.

The previous cut is preserved. This composition replaces its still media,
generic heading entrances, dark background and six stingers.

## Picture and story

| Frames  | Story and object continuity                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0–71    | Real backstab footage plays beside character-built “Stream over?” and “Keep it alive.” Bright OG purple/grid establishes the world.                                                  |
| 72–143  | Same playing clip contracts into a stream-moments composition. A second real Minecraft clip supports it. Pointer chooses the backstab moment.                                        |
| 144–203 | Same clip expands into the export source. Its frame, crop and media clock remain continuous. Headline exits directionally while new letters assemble.                                |
| 204–251 | Pointer draws gameplay and facecam regions. Both travel from source coordinates into a stacked 9:16 output; no source swap or distortion.                                            |
| 252–311 | Portrait playback continues. Export press resolves to Mobile.mp4, ready to share. No automatic social posting is claimed.                                                            |
| 312–359 | Same landscape clip becomes the next-stream player. Export result leaves with its own direction. Automatic selection card and identifiable upcoming Minecraft clip appear.           |
| 360–455 | Upcoming Minecraft video grows into playback without restarting its clock; previous clip exits before the source's in-game black transition. The queue visibly advances.             |
| 456–647 | Same Minecraft player becomes a theme canvas. Two choices alter color/font on the live player; pointer grabs, moves and releases metadata at alignment guides. Result stays applied. |
| 648–839 | Customized playing panel moves into the OG-inspired closing composition. Character-built “Let your clips talk.”, official icon and title-case Clipify. CTA follows; no logo stinger. |

All visible copy is JSX. Typography uses staggered character transforms/blur,
separate supporting-copy starts, fast directional departures and readable holds.
No opaque full-frame transition panel exists.

## Footage and claims

Both actual videos were discovered through Clipify's approved creator connection
for thedannicraft, then downloaded using the existing repository Twitch playback
lookup. `public/clipify-flow/media/sources.json` records public clip URLs,
titles, creator attribution and retrieval date. No signed playback tokens are
stored in the asset manifest. These archived clips illustrate product behavior;
the film does not claim they came from the same actual broadcast. UI is a
simplified animation, with no fabricated performance metrics/testimonials.

Backstab source: 1280×720, 30 fps, 27.33s. Minecraft: 1280×720, 30 fps, 21.83s.
Source clip sounds are muted so their existing broadcast music cannot replace
or compete with the approved score. The score preserves the approved music body and continues its arrangement
through the end screen, with action-specific cues.
No audio from the reference is copied.

The mobile output stacks a 16:9 facecam above gameplay in a 9:16 frame.
Facecam source: x=1044, y=32, width=224, height=126. Gameplay is centered on
x=640, full source height, with its width derived from the remaining output
area (approximately 592.46×720). Each part retains equal x/y scaling.
Every source/output instance uses the same composition frame and source trim.

The November refinement keeps the Inter brand family with lighter weights and
more open tracking, dark pill buttons, and a half-cell grid offset to remove
the bright border at the left edge. Overlay metadata follows the product's
separate channel/avatar/category and clip-title/clipper cards. Template previews
show the same live cards with Inter, regular serif and regular mono treatments.
The creator avatar is the connected channel's actual profile image:
https://static-cdn.jtvnw.net/jtv_user_pictures/5137a7ca-e89b-4f7a-b802-fd4c7aa0b8a9-profile_image-300x300.jpeg

Official icon: exact `src/app/icon.svg`; primary accent:
`oklch(48.8% 0.2839 284.35)`. Visual reference: `public/og-image.png`.
Inter font and OFL, plus existing DejaVu demonstration fonts, are local assets.
Arbitrary creator colors stay inside the customizable widget.

## Audio cues

`timeline.ts` is the shared source of event frames and sound cues; time in
seconds is frame / 30. The generated review CSV lists every cue and time.
Music is one continuous WAV. Success chords mark finished export and closing
composition; clicks mark actual pointer contact/release. Sweeps accompany real
object travel. Per-character entrances do not receive one sound per letter.

## Delivery and review

Generate audio, typecheck, render the complete preview, inspect all frames in
contact sheets and enlarge transition/crop/typography frames. Verify footage
motion, source/output correspondence, no unintended audio gaps, correct icon,
and readable final CTA. Render distribution directly from composition and save
a separate ProRes 4444 / PCM master with BT.709 metadata.

Campaign exceptions to generic guide: character animation and directional
object transfers replace standard whole-heading rises and crossfades, as
explicitly requested by the user.
