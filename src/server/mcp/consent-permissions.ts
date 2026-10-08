/** UI groups map only to scopes requested by the client; the backend checks them again. */
export type AccessLevel = "none" | "read" | "write";
export type ConsentMode = "read" | "write" | "custom";
export const CONSENT_GROUPS = [
	{ id: "creator", title: "Creator information", description: "View creator details, capabilities and discover Twitch clips. This does not grant account or billing access.", read: ["creator:read"], write: [] },
	{ id: "overlays", title: "Overlays", description: "Read overlay settings, playback status, queues and public embeds. Write can create, edit and delete overlays when requested.", read: ["overlay:read"], write: ["overlay:create", "overlay:update", "overlay:delete"] },
	{ id: "playlists", title: "Playlists", description: "Read playlists and preview clip imports. Write can create, edit and delete playlists and manage their clips.", read: ["playlist:read"], write: ["playlist:create", "playlist:update", "playlist:delete", "playlist-items:manage"] },
	{ id: "galleries", title: "Galleries", description: "Read galleries, previews and website embeds. Write can create, edit, delete, publish or unpublish galleries.", read: ["gallery:read"], write: ["gallery:create", "gallery:update", "gallery:delete", "gallery:publish"] },
	{ id: "pages", title: "Creator Page publishing", description: "Edit the page and change its publication status. Reading page settings is covered by Creator information.", read: [], write: ["creator:update"] },
	{ id: "remote", title: "Live remote control", description: "Control playback, change volume and add or clear queued clips. Reading playback and queues is covered by Overlays. Pro access still applies.", read: [], write: ["overlay:control"] },
	{ id: "runners", title: "Runners & streams", description: "Read runner status, setup instructions, stream sessions and snapshots. Write can configure runners, delete them and start or stop broadcasts. Runner access still applies.", read: ["runner:read"], write: ["runner:create", "runner:update", "runner:delete", "runner:control"] },
	{ id: "private-urls", title: "Private OBS URLs", description: "Read private browser-source URLs. These URLs grant access to your overlay and must not be published.", read: ["overlay-secret:read"], write: [] },
	{ id: "devices", title: "Runner device access", description: "Disconnect enrolled devices by rotating their credentials. This stops their sessions and requires fresh enrollment.", read: [], write: ["runner-credential:rotate"] },
	{ id: "feedback", title: "Bug reports & suggestions", description: "Submit feedback only when you request it and approve the message. Reports are sent to Clipify support.", read: [], write: ["feedback:create"] },
] as const;
export type ConsentGroup = (typeof CONSENT_GROUPS)[number];
export function availableGroups(requested: readonly string[]) {
	return CONSENT_GROUPS.filter((group) => [...group.read, ...group.write].some((scope) => requested.includes(scope)) && (group.id !== "pages" || requested.includes("creator:update")) && (group.id !== "remote" || requested.includes("overlay:control")) && (group.id !== "feedback" || requested.includes("feedback:create")));
}
export function groupLevel(group: ConsentGroup, scopes: readonly string[]): AccessLevel {
	return group.write.some((scope) => scopes.includes(scope)) ? "write" : group.read.some((scope) => scopes.includes(scope)) ? "read" : "none";
}
export function presetScopes(mode: "read" | "write", requested: readonly string[]) {
	return [
		...new Set(
			availableGroups(requested)
				.flatMap((group) => [...group.read, ...(mode === "write" ? group.write : [])])
				.filter((scope) => requested.includes(scope) && (scope !== "feedback:create" || requested.includes("creator:read"))),
		),
	];
}
export function groupScopes(group: ConsentGroup, level: AccessLevel, requested: readonly string[]) {
	return [...(level === "none" ? [] : group.read), ...(level === "write" ? group.write : [])].filter((scope) => requested.includes(scope));
}
/** Shell quote registered callback URLs without interpreting code/state or command substitutions. */
export function callbackCommand(url: string, tool: "curl" | "wget") {
	const quoted = "'" + url.replaceAll("'", "'\\''") + "'";
	return tool === "curl" ? `curl --globoff -- ${quoted}` : `wget -O /dev/null -- ${quoted}`;
}
