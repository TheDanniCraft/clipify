# Recovery after a deployment

Missing Server Actions are detected from Next.js's `x-nextjs-action-not-found`
response header, including when an editor catches the resulting error. The
client checks `/api/deployment`. A missing action also permits recovery after a
rebuild of the same commit, whose deployment ID may not have changed. An explicit
missing-action response still enables recovery when deployment metadata is absent.

Interactive pages ask before refreshing. Dismissing the prompt keeps the page
and edits intact and leaves an Update available button. An action ID explicitly
rejected by the server is not sent repeatedly by background polling. Mutations
are never replayed automatically.

Before the user refreshes, registered editors capture their changed fields in
sessionStorage for the current tab and path, with a 30-minute expiry. Keys are
scoped to the account/resource. Restored edits retain their original optimistic
revision, so another user's intervening changes still produce a conflict. Drafts
are consumed once and are not submitted until the user saves again.

Draft recovery covers settings, overlay configuration and themes, gallery
configuration, the playlist editor, and Runner configuration, schedules,
appearance and destination details. It does not serialize whole server resource
records or unchanged secrets. Passwords, stream keys and selected files prevent
refresh while populated; they are not written to draft storage. If storage is
blocked or full, refresh is refused and edits remain on the current page. Other
forms warn the user to copy edits before refreshing.

Unattended overlay, controller, gallery-player and Runner-presentation routes
retain periodic deployment checks and automatic refresh. Dashboard pages do not
periodically refresh. The existing one-minute reload guard limits repeated
refreshes to the same deployment.

The recovery client must already be loaded for these behaviors to apply. Tabs
opened before its first deployment need one manual refresh.
