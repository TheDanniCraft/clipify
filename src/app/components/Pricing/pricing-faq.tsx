"use client";

import { Accordion } from "@heroui/react";

export default function PricingFaq({ items }: { items: readonly { title: string; content: string }[] }) {
	return (
		<Accordion variant='surface'>
			{items.map((item) => (
				<Accordion.Item key={item.title} id={item.title}>
					<Accordion.Heading>
						<Accordion.Trigger>
							{item.title}
							<Accordion.Indicator />
						</Accordion.Trigger>
					</Accordion.Heading>
					<Accordion.Panel>
						<Accordion.Body>{item.content}</Accordion.Body>
					</Accordion.Panel>
				</Accordion.Item>
			))}
		</Accordion>
	);
}
