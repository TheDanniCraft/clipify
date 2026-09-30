# Graph Report - . (2026-09-27)

## Corpus Check

- 10 files · ~8,809 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 155 nodes · 207 edges · 10 communities (9 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)

- [[_COMMUNITY_Clipifyshowcase|Clipifyshowcase]]
- [[_COMMUNITY_Generate Soundtrack|Generate Soundtrack]]
- [[_COMMUNITY_Product Video Production Guide|Product Video Production Guide]]
- [[_COMMUNITY_Scripts|Scripts]]
- [[_COMMUNITY_Package|Package]]
- [[_COMMUNITY_Synth()|Synth()]]
- [[_COMMUNITY_Compileroptions|Compileroptions]]
- [[_COMMUNITY_Root|Root]]
- [[_COMMUNITY_Composition Level Reaction Overlays|Composition Level Reaction Overlays]]
- [[_COMMUNITY_Prores 4444 Archival Master|Prores 4444 Archival Master]]

## God Nodes (most connected - your core abstractions)

1. `scripts` - 16 edges
2. `synth()` - 13 edges
3. `compilerOptions` - 11 edges
4. `note()` - 9 edges
5. `mix()` - 9 edges
6. `random()` - 6 edges
7. `pluck()` - 6 edges
8. `impact()` - 6 edges
9. `uiPop()` - 5 edges
10. `achievement()` - 5 edges

## Surprising Connections (you probably didn't know these)

- `Continuous Transforming Score` --conceptually_related_to--> `Original Procedural Soundtrack` [INFERRED]
  packages/video/PRODUCTION_GUIDE.md → packages/video/README.md
- `Clipify Product Videos` --references--> `Product Video Production Guide` [EXTRACTED]
  packages/video/README.md → packages/video/PRODUCTION_GUIDE.md
- `Viewer Loss Sequence` --implements--> `Visible Event Sound Mapping` [EXTRACTED]
  packages/video/src/compositions/clipify-showcase/CUE_SHEET.md → packages/video/PRODUCTION_GUIDE.md
- `Bomb Reveal Recovery` --implements--> `Visible Event Sound Mapping` [EXTRACTED]
  packages/video/src/compositions/clipify-showcase/CUE_SHEET.md → packages/video/PRODUCTION_GUIDE.md
- `Reward Clip Flow` --implements--> `Visible Event Sound Mapping` [EXTRACTED]
  packages/video/src/compositions/clipify-showcase/CUE_SHEET.md → packages/video/PRODUCTION_GUIDE.md

## Hyperedges (group relationships)

- **Clipify Showcase Aspect-Ratio Compositions** — video_readme_clipifyshowcase, video_readme_clipifyshowcasevertical, video_readme_clipifyshowcasefeed, clipify_showcase_cue_sheet_45_second_trailer_timeline [EXTRACTED 1.00]
- **Clipify Showcase Synchronized Event Cues** — clipify_showcase_cue_sheet_viewer_loss_sequence, clipify_showcase_cue_sheet_bomb_reveal_recovery, clipify_showcase_cue_sheet_reward_clip_flow, video_production_guide_visible_event_sound_mapping [EXTRACTED 1.00]
- **Video Delivery Artifact Tiers** — video_readme_prores_4444_master, video_readme_h264_upload_export, video_readme_preview_export [EXTRACTED 1.00]

## Communities (10 total, 1 thin omitted)

### Community 0 - "Clipifyshowcase"

Cohesion: 0.05
Nodes (19): celebrationEmojis, celebrationPositions, ChatMessage, clamp, ClipifyShowcaseFormat, clipMessages, FloatingReaction, initialMessages (+11 more)

### Community 1 - "Generate Soundtrack"

Cohesion: 0.13
Nodes (24): arp, hat(), impact(), kick(), left, mix(), output, progression (+16 more)

### Community 2 - "Product Video Production Guide"

Cohesion: 0.11
Nodes (21): 45-Second Trailer Timeline, Bomb Reveal Recovery, Clipify Showcase Cue Sheet, Final Emoji Celebration, Illustrative Stream Activity, Reward Clip Flow, Viewer Loss Sequence, Continuous Transforming Score (+13 more)

### Community 3 - "Scripts"

Cohesion: 0.12
Nodes (16): scripts, audio:generate, render, render:feed, render:preview, render:preview:feed, render:preview:vertical, render:upload (+8 more)

### Community 4 - "Package"

Cohesion: 0.14
Nodes (13): dependencies, react, react-dom, remotion, @tabler/icons-react, devDependencies, @remotion/cli, @types/react (+5 more)

### Community 5 - "Synth()"

Cohesion: 0.28
Nodes (13): achievement(), chime(), clamp(), click(), dun(), failureTone(), messageTick(), note() (+5 more)

### Community 6 - "Compileroptions"

Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+4 more)

### Community 8 - "Composition Level Reaction Overlays"

Cohesion: 0.50
Nodes (4): Cross-Scene Reaction Lifecycles, Global OBS Mock Drift, Composition-Level Reaction Overlays, Persistent UI Spatial Continuity

### Community 9 - "Prores 4444 Archival Master"

Cohesion: 0.50
Nodes (4): Archival Master Pipeline, H.264 Upload Export, Preview Export, ProRes 4444 Archival Master

## Knowledge Gaps

- **71 isolated node(s):** `name`, `private`, `version`, `type`, `audio:generate` (+66 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `synth()` connect `Synth()` to `Generate Soundtrack`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _76 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Clipifyshowcase` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `Generate Soundtrack` be split into smaller, more focused modules?**
  _Cohesion score 0.1282051282051282 - nodes in this community are weakly interconnected._
- **Should `Product Video Production Guide` be split into smaller, more focused modules?**
  _Cohesion score 0.10952380952380952 - nodes in this community are weakly interconnected._
- **Should `Scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Package` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
