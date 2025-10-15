"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@heroui/react";
import { IconX } from "@tabler/icons-react";

export default function FloatingBanner({ icon, title, text, cta }: { icon: ReactNode; title: string; text: string; cta?: ReactNode }) {
	const [isDismissed, setIsDismissed] = useState(false);

	const handleClose = () => {
		setIsDismissed(true);
	};

	// Don't render if dismissed
	if (isDismissed) return null;

	return (
		<div className={"pointer-events-none z-20 fixed inset-x-0 bottom-0 w-full px-2 pb-2 sm:flex sm:justify-center sm:px-4 sm:pb-4 lg:px-8 transition-transform duration-300"}>
			<div className='relative rounded-large border-divider bg-primary pointer-events-auto flex items-center gap-x-3 border-1 px-6 py-2 sm:px-3.5 ring-4 ring-primary/30 shadow-[0_0_24px_rgba(99,102,241,0.45)]'>
				<div className='flex w-full items-center gap-x-3'>
					{icon}

					<div className='flex items-center gap-4'>
						<div className='text-left'>
							<p className='text-sm font-bold uppercase text-white/80'>{title}</p>
							<p className='text-lg sm:text-xl font-bold text-white'>{text}</p>
						</div>
						{cta}
					</div>
				</div>
				<div className='flex flex-1 justify-end'>
					<Button isIconOnly aria-label='Close Banner' className='-m-1' size='sm' variant='light' onPress={handleClose}>
						<IconX aria-hidden='true' className='text-default-500' width={20} />
					</Button>
				</div>
			</div>
		</div>
	);
}
