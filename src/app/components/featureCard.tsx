import React from "react";
import { Card, CardBody, Chip } from "@heroui/react";
import { IconConfetti, IconRocket } from "@tabler/icons-react";

interface FeatureCardProps {
	icon: React.ElementType;
	title: string;
	description: string;
	comingSoon?: boolean;
	isNew?: boolean;
}

export default function FeatureCard({ icon, title, description, comingSoon, isNew }: FeatureCardProps) {
	return (
		<Card className='border border-default-200 h-full' shadow='sm'>
			<CardBody className='p-6'>
				<div className='flex flex-col gap-4'>
					<div className='flex flex-row items-center justify-between'>
						<div className='bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center'>{React.createElement(icon, { className: "text-primary w-6 h-6" })}</div>
						{comingSoon && (
							<Chip color='primary' variant='bordered' startContent={<IconConfetti className='p-1' />}>
								Coming Soon
							</Chip>
						)}
						{isNew && (
							<Chip color='primary' variant='shadow' startContent={<IconRocket className='p-1' />}>
								New
							</Chip>
						)}
					</div>
					<h3 className='text-xl font-semibold'>{title}</h3>
					<p className='text-foreground-500'>{description}</p>
				</div>
			</CardBody>
		</Card>
	);
}
