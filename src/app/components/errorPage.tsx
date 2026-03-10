import { Card, CardBody, CardHeader } from "@heroui/react";
import type { ReactNode } from "react";

type ErrorPageProps = {
	title: string;
	description: string;
	actions?: ReactNode;
	imageSrc?: string;
	imageAlt?: string;
};

export default function ErrorPage({ title, description, actions, imageSrc = "/clippy/Clippy_sad.svg", imageAlt = "Clippy looks concerned" }: ErrorPageProps) {
	return (
		<main className='mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-8'>
			<Card className='w-full border border-primary/20 bg-content1/80 backdrop-blur'>
				<CardHeader className='flex flex-col items-center gap-3 pb-2 text-center'>
					<img src={imageSrc} alt={imageAlt} className='h-20 w-20' />
					<h1 className='text-xl font-semibold'>{title}</h1>
				</CardHeader>
				<CardBody className='flex flex-col items-center gap-4 pt-1 text-center'>
					<p className='max-w-xl text-sm text-default-500'>{description}</p>
					{actions ? <div className='flex flex-wrap items-center justify-center gap-2'>{actions}</div> : null}
				</CardBody>
			</Card>
		</main>
	);
}
