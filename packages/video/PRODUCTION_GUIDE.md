# Product video production guide

This guide defines the shared motion, sound, and implementation language for every composition in `packages/video`. It is intentionally product- and campaign-agnostic. Composition-specific storyboards, timings, claims, and cue tables belong beside that composition in a `CUE_SHEET.md`.

## Required composition structure

Each new trailer or social video should keep its files together:

```text
src/compositions/<composition>/
  <Composition>.tsx
  styles.css
  timeline.ts
  CUE_SHEET.md
scripts/<composition>/
  generate-soundtrack.mjs
public/<composition>/
  audio/
```

`timeline.ts` is the timing source of truth. Visual code and soundtrack generation must import the same frame constants instead of maintaining duplicate timestamps.

The cue sheet must contain:

- Composition FPS, duration, aspect ratio, and intended channel.
- Scene boundaries and narrative purpose.
- Every visible event that has a sound cue, expressed as both frame and time.
- Claims or illustrative data that require review.
- Any deliberate exception to this guide.

## Core principles

1. Every sound cue must explain a visible event. Do not add free-floating plings, clicks, impacts, or blinks.
2. Keep music continuous across scene changes. Change harmony, rhythm, texture, and energy instead of restarting the track.
3. Keep persistent UI spatially continuous. Carry global animation phase, scale, position, clocks, counters, and state across scene boundaries.
4. Use real HTML and JSX for text. Never bake interface copy into generated imagery.
5. Prefer the package's existing icon system and dependencies. Do not add a library for one decorative asset.
6. Make trailer claims confident, but distinguish illustrative UI from fabricated evidence.
7. Build the quietest sound design that still communicates the story. More visible activity does not require more pitched tones.

## Motion language

### Entrances

- Headlines use a restrained spring and short vertical rise.
- UI controls enter from a direction that supports the next interaction.
- Reactions appear individually or in small clusters, with varied positions and a shared visual family.
- Major state changes need a visible cause, readable anticipation, and a slower impact/reveal than ordinary UI feedback.
- Secondary effects must visibly originate from the element or event they explain. Prefer interface-native reactions over detached decorative bursts.
- Keep persistent reactions outside scene-local containers when their fade must cross an edit; scene ownership must not truncate a visible animation. Treat these overlays as composition-level layers above scene UI and let every reaction complete its own hold-and-fade lifecycle.
- Hold the final brand/CTA frame long enough for advertising and social placements to register it. Use subtle ambient motion during longer holds so the composition stays alive without competing with the message.

### Exits and transitions

- An element exits because the next action affects it. A pressed button may compress and disappear before the resulting state arrives.
- Avoid fades to black between connected product scenes.
- Crossfade content inside a persistent device or application frame instead of dissolving the whole frame.
- Persistent mock applications use a continuous global drift of roughly ±4 px vertically and ±0.5% scale. Never restart that motion at a scene boundary.
- The last frame of one scene and first frame of the next must be checked together.

### Reactions and activity

- Scatter transient reactions through the relevant content area instead of stacking them in one rigid column.
- Use small clusters when the screen should feel alive without becoming noisy.
- Negative reactions may use muted colors and downward emotional language; positive reactions may use brighter colors and upward motion.
- Reactions should drift, fade, and clear. They must not obscure primary copy, counters, controls, or captions.
- Chat can remain lightly active before a featured interaction, then accelerate after a clear audience action.

## Sound language

### Cue palette

- **Click:** a direct pointer press.
- **Message tick:** one newly visible chat message.
- **Reaction pop:** a short, mostly non-musical bubble sound for one reaction or a small simultaneous cluster.
- **Upward chime:** an actual positive counter change or meaningful gain, not every positive emoji.
- **Descending tone:** an actual negative counter change.
- **Whoosh:** visible directional travel.
- **Impact:** a major state change, not ordinary text or a small badge.
- **Achievement chord:** the final resolved state; warm and earned rather than theatrical.

### Density and hierarchy

- Reserve pitched cues for the events the viewer must notice: counter changes, rewards, or state changes.
- Give decorative reactions neutral pops so they do not compete harmonically with the score.
- When two visible events occur within roughly 6–10 frames, choose one dominant cue or combine them into one designed sound.
- A cluster of simultaneous reactions receives one pop unless separate sounds are narratively important.
- When reactions should feel organic, use deterministic irregular frame gaps rather than equal spacing or repeated two-item batches.
- Negative sequences may use grouped rhythm—such as three quick losses, a pause, then three more—to create structure without extending the scene.
- Check cue timing in frames, not rounded decimal seconds.

## Music direction

- Use one continuous score unless the story explicitly calls for silence.
- Establish a recognizable pulse early and transform it with the narrative.
- Communicate setbacks through harmony, register, rhythm, and texture—not generic horror stingers.
- Let the positive section inherit material from the negative section so the change feels like progress rather than a new track.
- Duck or thin the score around dense UI cues instead of adding louder effects.

## Implementation rules

- Keep reusable package guidance here; keep campaign decisions in the composition cue sheet.
- When one campaign ships in multiple aspect ratios, share its timeline, audio, copy, and scene components. Register separate compositions and isolate format-specific geometry so approving a social layout cannot silently change the established landscape master.
- Generate original sound in code or use assets with a documented commercial license.
- Use one frame-based timeline module for visuals and generated audio.
- Use deterministic animation only. A render must not change because of unseeded randomness.
- Prefer a short, complementary crossfade for adjacent scenes that otherwise create a hard visual cut; let the outgoing scene finish moving while the incoming scene establishes itself underneath.
- Clamp progress indicators to the visible media segment. Do not wrap them unless the media visibly loops too.
- Avoid overflow masks around live text. If a masked text transition is necessary, leave enough room for font ascenders and descenders at every rendered size.
- Keep promotional-only code and assets inside `packages/video`.
- Favor existing dependencies and small local primitives.

## Delivery quality

- Treat the local master and distribution exports as separate artifacts.
- Render archival masters from PNG intermediate frames into a high-bit-depth, 4:4:4 mezzanine codec such as ProRes 4444 with explicit BT.709 color metadata.
- Keep master audio uncompressed when the container supports it.
- Create H.264 or other size-limited deliverables directly from the composition or master. Never transcode from a preview or another compressed derivative.
- Preview renders are for iteration speed only and must not be published as final assets.

## Review checklist

- Scrub every cue and confirm the visible event begins on the same frame.
- Listen once without watching; every click, pop, tone, and impact should have an explainable source.
- Watch once muted; the narrative and all state changes should remain understandable.
- Inspect every scene boundary for position, scale, animation phase, clock, counter, and chat-state jumps.
- Check reaction density at full resolution and make sure primary UI remains legible.
- Verify that counter tones and decorative reaction pops are distinct and do not pile up.
- Run type checking, regenerate audio, and render the complete composition.
- Verify resolution, FPS, codec, audio channels, duration, and unintended silence before handoff.
