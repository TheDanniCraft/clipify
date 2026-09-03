export const clipifyShareDescription = "Clipify keeps your chat engaged with your best Twitch clips, even when you're taking a break.";

export function memberCardShareText(username: string, memberNumber: number | null, isOwner: boolean): string {
	const number = memberNumber !== null && memberNumber > 0 ? ` — member #${memberNumber}` : "";
	const introduction = isOwner ? `I'm part of the Clipify community${number}!` : `Meet ${username} from the Clipify community${number}!`;
	return `${introduction}\n\n${clipifyShareDescription}\n\n${isOwner ? "Proud to be part of it:" : "Part of the community:"}`;
}
