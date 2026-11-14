import type { ReactNode } from "react";

export default function ResourceLoadError({ message, children }: { message: string; children: ReactNode }) {
	return (
		<div className='flex flex-col items-start gap-3 rounded-xl bg-default/40 p-4 sm:flex-row sm:items-center sm:justify-between'>
			<p role='alert' className='text-sm text-muted'>
				{message}
			</p>
			<div className='flex shrink-0 flex-wrap items-center gap-2'>{children}</div>
		</div>
	);
}
