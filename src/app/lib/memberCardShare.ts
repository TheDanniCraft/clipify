export const clipifyShareDescription = "Clipify turns Twitch clips into stream overlays, playlists and shareable galleries, keeping your best moments playing even during breaks.";

export function memberCardShareText(username: string, memberNumber: number | null, isOwner: boolean): string {
	const number = memberNumber !== null && memberNumber > 0 ? ` — member #${memberNumber}` : "";
	const introduction = isOwner ? `I'm part of the Clipify community${number}!` : `Meet ${username} from the Clipify community${number}!`;
	return `${introduction}\n\n${clipifyShareDescription}\n\n${isOwner ? "Here's my member card:" : "See their member card:"}`;
}
