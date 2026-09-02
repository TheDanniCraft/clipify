"use client";

import { Button, Dropdown, Label } from "@heroui/react";
import { memberCardPath } from "@lib/memberCardLinks";
import { IconBrandDiscord, IconBrandLinkedin, IconBrandWhatsapp, IconBrandX, IconChevronDown, IconCopy, IconDownload, IconShare3 } from "@tabler/icons-react";
import { useState } from "react";

export default function MemberCardActions({ username, cardId, memberNumber, imageUrl = "/api/member-card", isOwner = false }: { username: string; cardId: string; memberNumber: number | null; imageUrl?: string; isOwner?: boolean }) {
	const [feedback, setFeedback] = useState("");
	const [manualLink, setManualLink] = useState("");
	const title = `${username}'s Clipify Member Card`;
	const text = isOwner ? (memberNumber && memberNumber > 0 ? `I'm member #${memberNumber} on Clipify. Here's my card!` : "I'm part of the Clipify community. Here's my member card!") : `Check out ${username}'s Clipify member card${memberNumber && memberNumber > 0 ? ` — member #${memberNumber}` : ""}.`;
	const downloadUrl = `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}download=1`;

	async function copy(url: string, discord = false) {
		try {
			await navigator.clipboard.writeText(discord ? `${text}\n${url}` : url);
			setManualLink("");
			setFeedback(discord ? "Copied! Paste it into your Discord chat." : "Member card link copied.");
		} catch {
			setManualLink(url);
			setFeedback("Copy this link to share your card.");
		}
	}

	async function share(action: string) {
		const url = new URL(memberCardPath(cardId), window.location.origin).href;
		setFeedback("");
		if (action === "copy" || action === "discord") return copy(url, action === "discord");
		if (action === "more") {
			if (!navigator.share) return copy(url);
			try {
				await navigator.share({ title, text, url });
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") return;
				await copy(url);
			}
			return;
		}
		const destinations: Record<string, string> = {
			linkedin: `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url })}`,
			x: `https://twitter.com/intent/tweet?${new URLSearchParams({ text, url })}`,
			whatsapp: `https://wa.me/?${new URLSearchParams({ text: `${text} ${url}` })}`,
		};
		if (destinations[action]) window.open(destinations[action], "_blank", "noopener,noreferrer");
	}

	return (
		<div className='w-full max-w-[360px] space-y-3'>
			<div className='flex gap-3'>
				<Dropdown>
					<Button className='flex-1' variant='primary' aria-label='Share member card'>
						<IconShare3 aria-hidden='true' size={18} /> Share <IconChevronDown aria-hidden='true' size={14} />
					</Button>
					<Dropdown.Popover>
						<Dropdown.Menu
							aria-label='Share member card options'
							onAction={(key) => {
								void share(String(key));
							}}
						>
							<Dropdown.Item id='copy' textValue='Copy link'>
								<IconCopy aria-hidden='true' size={18} />
								<Label>Copy link</Label>
							</Dropdown.Item>
							<Dropdown.Item id='linkedin' textValue='Share to LinkedIn'>
								<IconBrandLinkedin aria-hidden='true' size={18} />
								<Label>LinkedIn</Label>
							</Dropdown.Item>
							<Dropdown.Item id='x' textValue='Share to X'>
								<IconBrandX aria-hidden='true' size={18} />
								<Label>X</Label>
							</Dropdown.Item>
							<Dropdown.Item id='discord' textValue='Copy for Discord'>
								<IconBrandDiscord aria-hidden='true' size={18} />
								<Label>Copy for Discord</Label>
							</Dropdown.Item>
							<Dropdown.Item id='whatsapp' textValue='Share to WhatsApp'>
								<IconBrandWhatsapp aria-hidden='true' size={18} />
								<Label>WhatsApp</Label>
							</Dropdown.Item>
							<Dropdown.Item id='more' textValue='More sharing options'>
								<IconShare3 aria-hidden='true' size={18} />
								<Label>More options…</Label>
							</Dropdown.Item>
						</Dropdown.Menu>
					</Dropdown.Popover>
				</Dropdown>
				<a className='button button--secondary flex-1 text-foreground' href={downloadUrl} download aria-label='Download member card PNG'>
					<IconDownload aria-hidden='true' size={18} /> Download PNG
				</a>
			</div>
			<p className='text-xs text-muted' role='status'>
				{feedback}
			</p>
			{manualLink ? <input aria-label='Member card link' readOnly value={manualLink} onFocus={(event) => event.currentTarget.select()} className='w-full rounded-lg border border-border bg-surface p-2 text-sm text-foreground' /> : null}
		</div>
	);
}
