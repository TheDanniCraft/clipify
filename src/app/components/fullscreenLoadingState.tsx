import { Spinner } from "@heroui/react";

export default function FullscreenLoadingState({ message }: { message: string }) {
	return (
		<div className='flex h-screen w-full flex-col items-center justify-center gap-2' role='status' aria-live='polite'>
			<Spinner />
			<span>{message}</span>
		</div>
	);
}
