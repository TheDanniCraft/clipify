# Clipify OpenAI review guide

Package version: `1.0.0`  
Subtitle: `Keep your stream alive`  
MCP server: `https://clipify.us/mcp`  
Demo creator: `richieboooy` (`843207020`)

## Reviewer credentials

- Sign-in method: **Magic link or email code**.
- Reviewer email: `mcp-review@theaicompany.org`.
- Login URL: `https://clipify.us/login/editor`.
- Tenant/workspace: `richieboooy`.

Paste these sign-in steps into the review form:

```text
1. Open https://clipify.us/login/editor.
2. Enter mcp-review@theaicompany.org and click "Send sign-in code".
3. Enter the code received by email and click "Sign in".
4. The account opens the richieboooy workspace. If a workspace selector appears, choose richieboooy and continue.
5. Return to OpenAI and connect Clipify. Select the richieboooy creator, choose the permissions needed for the test cases, and authorize the connection.

The workspace is already provisioned with sample Twitch clips, Pro access, and Runner access. No registration, payment, or Twitch sign-in is required.
```

The sign-in method above matches the email-code option in the submission portal. Reviewer credentials belong in the portal, not in the public plugin ZIP.

## Video recording guide

OpenAI requires an accessible recording demonstrating the test cases and plugin functionality: [official submission guide](https://developers.openai.com/plugins/deploy/submission).

The steps below are a suggested recording sequence, not an additional OpenAI requirement. The video has not been recorded or uploaded yet.

### Prepare

1. Open ChatGPT with the Clipify draft plugin enabled and connected to **richieboooy**. Use your existing authorized demo-creator account for the recording; the review team will use its own email-code login.
2. Allow the creator read/update, playlist read/create/update/item management, overlay read/create/update, and gallery read/create/update/publication permissions needed by the cases below.
3. Open the richieboooy Clipify dashboard in another tab so you can show saved changes.
4. Start a fresh conversation. Use the prompts below exactly, or with only small wording changes. If ChatGPT asks for confirmation, approve the action on the demo account.
5. Start recording after sign-in and connection. Keep the prompts, tool activity, responses, and relevant Clipify settings readable. No live stream, installed Runner, or connected overlay player is needed.

### Record these five sections

1. **Discover creators and clips.** Run positive case 1. Show richieboooy, the available features, completed historical crawling, and returned clip titles and links.
2. **Create and edit a playlist.** Run positive case 2. Show the created playlist in Clipify with its final name and three selected clips.
3. **Customize an overlay.** Run positive case 3. Show the saved purple accent, enabled progress bar, and 25% playback volume in Clipify. This case does not test live playback controls.
4. **Create and publish a gallery.** Run positive case 4. Show its clip preview, published status, and returned Clipify Elements embed snippet and instructions. Installing the snippet on another website is not part of this case.
5. **Customize the creator page.** Run positive case 5. Show unlisted visibility and the saved social preview title and description.

After recording, upload the video and put its shareable viewing URL in **Video walkthrough URL**. Verify that the link opens without requiring the reviewer to request access. There is no recording URL to paste yet.

## Positive test cases

Use only the dedicated richieboooy creator. Cases can run independently. The assistant should use returned resource IDs, current configuration revisions, and fresh retry keys for new creations.

### Test case 1 - Discover creators and clips

**Scenario:** Find the connected creator, inspect available features, and search its cached clips.

**User prompt:**

```text
Show my connected Clipify creators. For richieboooy, show my available features, check the clip crawler's status, and find up to five clips across all dates. Include their titles, durations, view counts, and Twitch links.
```

**Tools triggered:** `list_creators`, `get_capabilities`, `get_clip_crawler_status`, `search_clips`.

**Expected output:** richieboooy is accessible, Pro and Runner features are available, historical crawling is complete, and sample clips are returned with their metadata and links.

### Test case 2 - Create and edit a playlist

**Scenario:** Build a playlist from real sample clips and verify the saved contents.

**User prompt:**

```text
For richieboooy, create a playlist named "OpenAI Review Playlist". Find up to three clips across all dates and add them to it. Rename the playlist to "OpenAI Review Favorites", then show its saved name and clip list.
```

**Tools triggered:** `search_clips`, `create_playlist`, `add_playlist_items`, `update_playlist`, `get_playlist`.

**Expected output:** A new playlist contains the selected clips and has the final name "OpenAI Review Favorites". Saved values are read back using the created playlist ID.

### Test case 3 - Create and customize an overlay

**Scenario:** Create an overlay, customize its appearance and playback settings, and verify the saved configuration.

**User prompt:**

```text
For richieboooy, create an overlay named "OpenAI Review Overlay". Set its theme accent to purple (#6200FF), enable the progress bar, and set its playback volume to 25%. Then show me its saved configuration.
```

**Tools triggered:** `create_overlay`, `get_overlay_theme`, `update_overlay_theme`, `get_overlay_playback`, `update_overlay_playback`, `get_overlay`.

**Expected output:** The new overlay's saved configuration shows the purple accent, enabled progress bar, and 25% playback volume. No connected player or streaming software is required.

### Test case 4 - Create and publish a gallery

**Scenario:** Create a public clip gallery, preview its contents, and obtain installation instructions.

**User prompt:**

```text
For richieboooy, create a gallery named "OpenAI Review Gallery". Use the live clip collection across all dates, with a grid layout and purple accent (#6200FF). Show its clip preview, publish it, and give me the Clipify Elements embed snippet and installation instructions.
```

**Tools triggered:** `create_gallery`, `get_gallery_source`, `update_gallery_source`, `get_gallery_filters`, `update_gallery_filters`, `get_gallery_layout`, `update_gallery_layout`, `get_gallery_theme`, `update_gallery_theme`, `get_gallery`, `get_gallery_preview`, `publish_gallery`, `get_gallery_embed`.

**Expected output:** The gallery saves its live source, all-dates filter, grid layout, and purple accent. Its preview contains sample clips, publication succeeds, and the supported Clipify Elements snippet and installation instructions are returned.

### Test case 5 - Customize the creator page

**Scenario:** Update the demo creator's page settings and verify they were saved.

**User prompt:**

```text
For richieboooy, set my creator page visibility to unlisted. Set its social preview title to "Richieboooy's Clipify Showcase" and its social preview description to "Explore sample Twitch clips with Clipify." Then show me the saved settings.
```

**Tools triggered:** `get_creator_page`, `update_creator_page`, `get_creator_page`.

**Expected output:** The creator page saves unlisted visibility and the requested social preview title and description. The assistant reads the current configuration revision before updating and confirms the saved values afterward.

## Negative test cases

These are prompts where Clipify tools should not be invoked.

### Test case 1 - Video editing

**Scenario:** The user wants to edit a video file, rather than manage Clipify resources. Clipify's MCP server does not trim files, add subtitles, or render MP4 exports.

**User prompt:**

```text
Trim this uploaded video to 30 seconds, add subtitles, and export it as an MP4.
```

**Expected behavior:** Do not invoke Clipify tools. Explain the unsupported task or use an appropriate available video-editing capability.

### Test case 2 - Twitch account security

**Scenario:** The user wants to change Twitch security settings, which Clipify's MCP tools do not support.

**User prompt:**

```text
Change my Twitch password and enable two-factor authentication on my Twitch account.
```

**Expected behavior:** Do not invoke Clipify tools. Direct the user to Twitch's account security settings.

### Test case 3 - Social media publishing

**Scenario:** The user wants to upload a video to social platforms, rather than publish a Clipify gallery or creator page. Clipify has no TikTok or Instagram upload tools.

**User prompt:**

```text
Upload this video to TikTok and Instagram Reels with the caption "My best moment".
```

**Expected behavior:** Do not invoke Clipify tools or claim an upload succeeded. Explain the limitation or use an appropriate available publishing integration.

## Release notes

Paste these notes for plugin package version `1.0.0`:

```text
✨ Connect your AI assistant to Clipify
🎬 Find clips and manage overlays, playlists, and galleries
💄 Customize overlay appearance and creator pages
🔒 Choose creator access and permissions when connecting
```

## Live verification

All five positive MCP tool cases passed against `https://clipify.us/mcp` on October 12, 2026, using the existing authorized richieboooy MCP session:

- Creator discovery and capabilities succeeded; nine clips were cached and five were returned by the search. Historical crawling was complete.
- A playlist was created, populated with three clips, renamed, and read back successfully.
- An overlay was created and read back with `#6200FF`, the progress bar enabled, and volume `25`.
- A gallery was configured, previewed with five clips, published, and returned its Elements snippet and installation guide.
- The creator page's unlisted visibility and social preview text were saved and read back successfully.

The resources created during these checks were deleted afterward, and the original creator-page settings were restored. The recording will create fresh resources using the prompts above.

This evidence verifies live MCP tool behavior. It does not verify the review team's email-code login or ChatGPT's selection of tools from these prompts. Those remain part of the actual review and recording workflow. The negative prompts above describe expected behavior; they have not been evaluated through ChatGPT.
