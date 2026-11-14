# Your last stream fuels your next

Current narrative script — 2026-11-13. Supersedes the main-cut story in `../clipify-pulse/REPLAN.md`. The 12.8-second audition remains the approved musical direction, not the final visual treatment. This document specifies the next full animatic; it does not describe an already rendered film.

## Creative decision

Start on a simplified stream overview with a real clip timeline. One moment expands, then becomes the recurring visual anchor across three uses: an export, break-screen playback, and a public gallery. Customization and audience participation are demonstrated inside that story.

The viewer should leave thinking: **“I already made these moments. Clipify helps me do more with them.”**

Use “Your last stream fuels your next” as the narrative backbone and closing line. Avoid a long explanation of that metaphor. Show the product benefit through visible transformations.

## What the code changes about the story

The earlier broad source inventory and capability map remain in `../clipify-pulse/REPLAN.md`. This follow-up rechecked the stream-to-clip flow and the implemented destinations at local HEAD `7ab6f64a`. The product graph lacks some newer stream/composition symbols, so those flows were inspected directly through their current route imports. This is source-based feature/flow research, not a claim of line-by-line review of the entire application or live-account journey execution.

| Finding                                                                                                                     | Code evidence                                                                                                                                                                                                                       | Consequence for the film                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A stream detail page combines its clip inventory with stream moments, start/end markers, timestamps and grouped clips       | `src/app/dashboard/streams/[videoId]/page.tsx`, `src/app/components/creator/streamMoments.tsx`, `src/app/lib/streamMoments.ts`                                                                                                      | Open on a broadcast summary plus thumbnail moments, not a waveform. A group can open to reveal alternate clips of that moment.                                          |
| Moments are existing clips grouped by overlapping VOD offsets; the most-viewed clip leads each group                        | `src/app/lib/streamMoments.ts`                                                                                                                                                                                                      | Do not portray an AI scanning a full VOD and generating highlights. Selection reveals an existing clip.                                                                 |
| Clip detail supports preview, source-stream navigation, layout customization, original download and configured exports      | `src/app/components/creator/clipDetails.tsx`, `src/app/components/creator/clipExportSettings.tsx`                                                                                                                                   | Export is one short, convincing destination, not the whole narrative. “Ready to share” is supported; “Posted” is not.                                                   |
| Layouts support Desktop/Mobile compositions, source crops and title/channel metadata                                        | `src/app/lib/clipComposition.ts`, `src/app/components/creator/clipCompositionEditor.tsx`, `src/app/actions/clipLayoutLibrary.ts`                                                                                                    | Show camera and gameplay reframing into a vertical composition; no lengthy export wizard.                                                                               |
| Overlays play from configured clip sources, including automatic selection and optional playlists                            | `src/app/components/overlayPlayer.tsx`, `src/app/actions/twitch.ts`, `src/app/lib/types.ts`                                                                                                                                         | The clip reappears in the next stream's break scene, then another clip follows. Hand-picking is a storytelling anchor, not a required playback workflow.                |
| Viewer Channel Points requests validate clips from the creator and enqueue them                                             | `src/app/eventsub/route.ts`, `src/server/clip-queue.ts`                                                                                                                                                                             | A real cause/effect beat: redemption → queue entry → eventual playback. The reward uses an eligible clip link.                                                          |
| Shared brand settings and Theme Studio control fonts/colors and supported widget positions, sizes, progress and effects     | `src/app/components/settings/BrandSettingsPanel.tsx`, `src/app/dashboard/overlay/[overlayId]/theme/page.tsx`                                                                                                                        | Style the actual player in place. Demonstrate different fonts and geometry, not four similar purple swatches.                                                           |
| Galleries resolve original Twitch clips from a live source or a curated playlist; Creator Pages also expose browsable clips | `src/app/lib/gallery.ts`, `src/server/resources/galleries.ts`, `src/app/lib/creatorPage.ts`                                                                                                                                         | Return to the original clip card before forming the gallery. Do not imply uploading the exported MP4 back into Clipify.                                                 |
| Runner, team/agency access, analytics, AI assistant access and community identity are additional implemented capabilities   | `src/server/runner/capabilities.ts`, `src/auth/permissions.ts`, `src/app/dashboard/agency/page.tsx`, `src/app/actions/creatorAnalytics.ts`, `src/server/mcp/workflows/catalogue.ts`, `src/app/components/membership/MemberCard.tsx` | Considered in the feature audit. Reserve them for focused follow-ups; they do not strengthen this specific 32-second story enough to justify another explanatory scene. |

## Script — 32 seconds

30 FPS, 960 frames, 150 BPM, 20 bars. Extend the audition's musical vocabulary into a composed full-length arrangement. Preserve its driving groove, bass sound and drum character. No voiceover assumed.

### 0.0–3.2 s · Your stream ended. Its moments didn't.

**Copy:** `STREAM OVER.` → `MOMENTS? FAR FROM IT.`

Start in motion: a broadcast summary card slides into a large central position. Clipify branding is already visible. Beneath it, a line connects thumbnail cards at actual-looking timestamps: `00:18:42`, `01:06:12`, `02:14:08`, `03:28:51`. Endpoints read Stream start / Stream end. Each card has a title; two overlapping moments show stacked thumbnails and a small clip-count badge. No audio waveform or continuously varying vertical bars.

Cards enter rhythmically, not all simultaneously. The camera moves towards “The clutch.” A group opens, revealing its existing clips. One thumbnail is selected as the strongest illustrative moment.

**Sound:** continue the approved energetic entrance. Short tactile ticks belong to card arrivals; one direct click selects the clip.

### 3.2–4.8 s · One moment, several possibilities

**Copy:** `THAT MOMENT HAS MORE TO GIVE.`

The selected thumbnail lifts from its exact timeline position and expands into playing media. The stream page recedes rather than fading to black. Three small destination tiles briefly fan out around it: **Share / On stream / Your website**. Each contains the same recognizable thumbnail/title. These are editorial labels, not a fabricated Clipify action menu.

The share tile moves forward first. The other two remain as small visual anchors so the viewer knows this is a branching story.

**Sound:** directional travel into a clear downbeat. Let the next musical phrase propel the first transformation.

### 4.8–8.0 s · Take it beyond the stream

**Copy:** `MAKE IT SHAREABLE.`

Source crop outlines identify gameplay and camera. They separate and settle into a vertical composition beside the landscape source. The creator's title/channel widget attaches. A concise export action produces `Mobile.mp4` with a completion check; the landscape version remains visible as another available format.

Do not hold on a processing percentage. The transformation is the scene. The resulting file becomes a small completed share tile and moves aside. We return to the original clip card for the next use.

**Sound:** two distinct crop snaps, one metadata attachment and one export completion, arranged within the music rather than a chain of melodic notifications.

### 8.0–14.4 s · Let the last stream entertain the next

**Copy:** `YOU TAKE A BREAK.` → `YOUR MOMENTS TAKE OVER.`

The original clip expands into a stream player as a simple scene selector switches to BRB. A readable **Clips from your channel** source chip establishes automatic playback. Two more clip cards feed an Up next strip; playback progress advances and the player changes clips once. This makes it clear that the creator is not manually launching every clip.

Then a viewer redeems a Channel Points reward using an eligible clip link. The requested clip visibly enters the queue. At the current clip's end, it advances to playback; the queue removes the played item. Keep a small Channel Points label so the mechanism is understandable without knowing the UI.

The stream-player mockup occupies most of the canvas. Chat and queue are supporting elements attached to it, not generic floating notifications covering the footage. Do not fabricate a rise in viewer numbers.

**Sound:** scene switch click; continuous driving beat; one redemption/queue cue; a stronger accent for the actual player change. Let the music thin briefly around the request and return with playback.

### 14.4–19.2 s · Recognizably yours

**Copy:** `YOUR CHANNEL. YOUR LOOK.`

Keep the player and clip continuous. A compact styling control appears at its edge. A pointer changes the look; the output visibly responds:

1. Mint/ink with a heavy sans font and compact lower-left metadata.
2. Orange/cream with a serif and a taller metadata card.
3. Cyan/black with monospace, repositioned information and a distinct progress treatment.

Choose two clear changes and one final hold rather than flashing through unreadable palettes. Show the pointer move a widget so layout customization is demonstrated, not just implied by color changes. Keep Clipify's own logo and surrounding campaign surfaces in its official purple/dark brand system.

**Sound:** short dry selection cues and one spatial snap. The changes ride the existing rhythmic phrase. No new song and no restart in playback/progress.

### 19.2–24.0 s · A home beyond live

**Copy:** `GOOD MOMENTS DON'T END WITH THE STREAM.`

The original clip card pulls forward from the player and lands in a website gallery. Related thumbnails assemble around it. The creator identity/header and a visible **Your website** label establish where we are. The hero clip opens in the gallery player.

A small shareable Creator Page link can complete the scene if it remains readable; it is secondary and can be removed. Do not force an extra full profile walkthrough. The media/title remain recognizable from the opening.

**Sound:** card cascade as a grouped rhythmic gesture; direct click and focused player-open accent.

### 24.0–28.8 s · The whole promise in one picture

**Copy:** `YOUR LAST STREAM` → `FUELS YOUR NEXT.`

Pull back to reveal the original stream's moments at the left and the three completed uses arranged around the hero clip: the mobile export, the styled break player, and the gallery. Keep media alive inside the surfaces. The next-stream player becomes dominant, visually completing the past → next idea.

This is the payoff, not a technical flowchart. Use matching thumbnails, shared movement paths and clear hierarchy. Avoid spaghetti connectors or opening a new feature. The earlier destinations now feel like parts of the same product rather than disconnected screenshots.

**Sound:** build from familiar rhythmic material, then land the strongest payoff hit as the next-stream player locks in place.

### 28.8–32.0 s · Brand and invitation

**Copy:** `CLIPIFY` / `LET YOUR CLIPS TALK.` / `START FREE WITH TWITCH` / `CLIPIFY.US`

The three surfaces converge into the logo shape, then clear for a clean brand close. Hold the invitation for the final two-plus seconds. A subtle rhythmic light movement keeps the frame alive. Include readable `Includes Pro features` supporting text; identify the relevant advanced feature sequences with a compact Pro marker.

**Sound:** decisive musical resolve and a controlled tail, retaining the approved track's character.

## Visual rules for implementation

- Build in Remotion with real React/SVG/HTML elements. Mockups can enlarge, simplify or separate implemented controls. Full screenshots are optional, not the scene structure.
- Stop repeating a left-aligned headline beside a static right-aligned window. Alternate full-stage overview, close-up hero media, layered composition and a dominant live player. Copy supports the action instead of consuming half every frame.
- One recognizable clip identity persists throughout, but additional moments have different thumbnails. Avoid four identical copies of the same placeholder under different titles.
- Use the timeline's real language: thumbnails, timestamps, start/end, overlapping clip stacks. Do not use a waveform, audio spectrum, fictional highlight score or AI scan animation.
- The prior SVG gameplay/facecam are audition placeholders. Use suitable product-owned or authorized clip media for polished scenes when available. Preserve the same media identity across crops and destinations.
- The three-use fan-out is an editorial explanation of reuse. Do not invent a one-click publish/export/overlay/gallery operation. Show each destination's observable result without implying nonexistent workflow controls.
- Export files are ready for the creator to post. The script does not show Clipify publishing to social platforms or using the exported file as an overlay/gallery source.
- Playback can use an automatic source; hand-picking one clip is only how the film introduces its recurring moment.
- Every designed sound is tied to the visible action. Keep the music continuous and sync movement/contact/result to shared frame constants.

## Next production deliverable

A full 32-second rough animatic using the approved music direction and this script. Prioritize the corrected stream timeline, the three-use branching transition and the large overlay/customization sequence. Review the connected narrative before producing distribution masters.

The existing audition, soundtrack assets and product source remain unchanged by this script revision.
