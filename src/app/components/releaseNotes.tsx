"use client";
import { releaseSummary } from "@lib/releaseSummary";

export default function ReleaseNotes({ body }: { body: string }) {
	return (
		<ul className='list-disc space-y-3 pl-5 marker:text-accent'>
			{releaseSummary(body).map((line, index) => (
				<li key={index} className='text-base leading-relaxed text-foreground/80'>
					{line}
				</li>
			))}
		</ul>
	);
}
