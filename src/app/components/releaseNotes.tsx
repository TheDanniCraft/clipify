"use client";
import { Accordion } from "@heroui/react";
import { releaseSummary } from "@lib/releaseSummary";

export default function ReleaseNotes({ body }: { body: string }) {
	const summary = releaseSummary(body);
	return (
		<>
			<ul className='space-y-3'>
				{summary.map((line, index) => (
					<li key={index} className='text-sm leading-relaxed'>
						{line}
					</li>
				))}
			</ul>
			<Accordion className='mt-4' variant='surface'>
				<Accordion.Item id='details'>
					<Accordion.Heading>
						<Accordion.Trigger>
							{summary.length ? "All release notes" : "Maintenance details"}
							<Accordion.Indicator />
						</Accordion.Trigger>
					</Accordion.Heading>
					<Accordion.Panel>
						<Accordion.Body>
							<p className='whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/75'>{body}</p>
						</Accordion.Body>
					</Accordion.Panel>
				</Accordion.Item>
			</Accordion>
		</>
	);
}
