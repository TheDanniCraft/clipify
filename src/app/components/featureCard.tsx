import React from "react";
import { Card, Chip } from "@heroui/react";

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
		<Card className='border border-default-200 h-full shadow-sm'>
			<Card.Content className='p-6'>
				<div className='flex flex-col gap-4'>
					<div className='flex flex-row items-center justify-between'>
						<div className='bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center'>{React.createElement(icon, { className: "text-primary w-6 h-6" })}</div>
						{comingSoon && (
							<Chip color='accent' variant='secondary'>
								<IconConfetti className='p-1' />
								<span>Coming Soon</span>
							</Chip>
						)}
						{isNew && (
							<Chip color='accent' variant='primary' className='shadow-lg'>
								<IconRocket className='p-1' />
								<span>New</span>
							</Chip>
						)}
					</div>
					<h3 className='text-xl font-semibold'>{title}</h3>
					<p className='text-foreground-500'>{description}</p>
				</div>
			</Card.Content>
		</Card>
	);
}
