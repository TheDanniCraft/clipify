"use client";
import { useSyncExternalStore, type ReactNode } from "react";

const subscribeToHydration = () => () => undefined;
const clientReady = () => true;
const serverReady = () => false;

export default function DashboardEditorLayout({ children }: { children: ReactNode }) {
	const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
	return (
		<div className='flex w-full flex-col items-center py-4'>
			<fieldset disabled={!ready} aria-busy={!ready} className='contents'>
				<section aria-label='Editor workspace' className='w-full max-w-5xl space-y-6'>
					{children}
				</section>
			</fieldset>
		</div>
	);
}
