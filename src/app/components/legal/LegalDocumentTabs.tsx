"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Tabs } from "@heroui/react";
import { legalDocuments } from "@lib/legal/documents";

export default function LegalDocumentTabs({ activeDocumentId, children }: { activeDocumentId: string; children: ReactNode }) {
	const router = useRouter();

	return (
		<Tabs
			selectedKey={activeDocumentId}
			variant='secondary'
			className='w-full'
			onSelectionChange={(key) => {
				const destination = legalDocuments.find((item) => item.id === key)?.route;
				if (destination) router.push(destination);
			}}
		>
			<Tabs.ListContainer className='border-b border-default bg-transparent'>
				<Tabs.List aria-label='Legal documents' className='justify-start'>
					{legalDocuments.map((item) => (
						<Tabs.Tab key={item.id} id={item.id}>
							{item.title}
							<Tabs.Indicator />
						</Tabs.Tab>
					))}
				</Tabs.List>
			</Tabs.ListContainer>
			{legalDocuments.map((item) => (
				<Tabs.Panel key={item.id} id={item.id} className='px-0 py-0'>
					{item.id === activeDocumentId ? children : null}
				</Tabs.Panel>
			))}
		</Tabs>
	);
}
