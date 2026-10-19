import type { ReactNode } from "react";

export default function DashboardEditorLayout({ children }: { children: ReactNode }) {
	return (
		<div className='flex w-full flex-col items-center p-4'>
			<section aria-label='Editor workspace' className='w-full max-w-4xl space-y-6'>
				{children}
			</section>
		</div>
	);
}
