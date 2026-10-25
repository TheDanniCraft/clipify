# UI and event contract

Launcher: authenticated dashboard only; `Get started · n/4` before core completion, `Guides` after. Expandable sections: Get your first overlay running, Make your overlay yours, Build a playlist. Optional journeys have independent progress. No website/24-7 placeholders.

Action reports are typed and scoped to the authenticated account; consumers ignore foreign resource owners. Overlay reports include ID, saved name/source validity and playlist association, never secret URL. Copy reports only after clipboard promise resolves. Preview report only for nonempty matching clips. Theme report only after successful save of a visible change. Playlist reports include ID and saved clip count/order state. Report failure by leaving existing error UI and progress unchanged.

Tours point to stable data-tour attributes. Guidance steps must distinguish informational Next from action waits. Missing target is recoverable and does not silently complete a step. External instructions expose OBS/Streamlabs browser source, private URL, 1920x1080 and explicit confirmation. Modal steps retain application focus management.
