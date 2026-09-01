"use client";

import { Button } from "@heroui/react";
import { IconDownload, IconShare3 } from "@tabler/icons-react";
import { useState } from "react";

export default function MemberCardActions({ username, imageUrl, sharePath }: { username: string; imageUrl?: string; sharePath?: string }) {
	const [sharing, setSharing] = useState(false);

	function download() {
		const anchor = document.createElement("a");
		anchor.href = `${imageUrl ?? "/api/member-card"}${(imageUrl ?? "/api/member-card").includes("?") ? "&" : "?"}download=1`;
		anchor.download = `clipify-member-${username}.png`;
		anchor.click();
	}

	async function share() {
		setSharing(true);
		try {
			const publicUrl = new URL(sharePath ?? `/members/${encodeURIComponent(username)}`, window.location.origin).toString();
			const response = await fetch(imageUrl ?? "/api/member-card");
			if (!response.ok) throw new Error("Could not create Member Card");
			const file = new File([await response.blob()], `clipify-member-${username}.png`, { type: "image/png" });
			const shareData = { title: `${username}'s Clipify Member Card`, text: `I'm ${username} on Clipify.`, url: publicUrl, files: [file] };
			if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
				await navigator.share(shareData);
				return;
			}
			if (navigator.share) {
				await navigator.share({ title: shareData.title, text: shareData.text, url: shareData.url });
				return;
			}
			download();
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") return;
			download();
		} finally {
			setSharing(false);
		}
	}

	return (
		<div className='flex w-full max-w-[360px] gap-3'>
			<Button className='flex-1' variant='primary' isPending={sharing} onPress={share}>
				<IconShare3 aria-hidden='true' size={18} />
				Share
			</Button>
			<Button className='flex-1' variant='secondary' onPress={download}>
				<IconDownload aria-hidden='true' size={18} />
				Download
			</Button>
		</div>
	);
}
