# Data model

GuideProgress version 1: completed task IDs (allowlisted, unique), chosen owned overlay/playlist IDs (nonempty bounded strings), active task and pointer index, panel minimized preference. Key `clipify:user-tour:v1:<accountId>`. Unknown version/invalid shapes reset safely. Unknown task IDs ignored. No credentials or URLs persisted. State only grants instructional progress, never authorization.

Transitions: idle -> active on user start; active -> paused on close/Escape/navigation/missing target; paused -> active on resume; task -> complete only on matching successful event. Replay starts guidance against an existing resource, preserving completed tasks. Independent successful actions also complete matching tasks. Setup requires a successful copy plus explicit confirmation. Theme skip pauses without completing customization. Playlist steps require saved clips/order and an overlay association.

## UX revision fields

GuideProgress remains version 1 and accepts existing completion arrays. Missing skipped arrays parse to empty; valid skipped IDs are deduplicated and completed IDs take precedence. Active tasks add optional done=true for the explicit completion handoff. New storage defaults show the checklist while keeping active=null. Existing minimized preferences remain respected. A skip does not call domain mutations or emit a successful save outcome. Resource IDs and route construction retain their existing bounds and ownership rules.
