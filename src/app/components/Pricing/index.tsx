"use client";

import React, { useState } from "react";
import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Divider, Link, Spacer, Tab, Tabs } from "@heroui/react";
import { cn } from "@heroui/react";

import { tiers, frequencies } from "./pricing-tiers";
import { IconCheck } from "@tabler/icons-react";
import { FrequencyEnum } from "./pricing-types";

export default function TiersComponent() {
	const [selectedFrequency, setSelectedFrequency] = useState(frequencies[0]);

	const onFrequencyChange = (selectedKey: React.Key) => {
		const frequencyIndex = frequencies.findIndex((f) => f.key === selectedKey);

		setSelectedFrequency(frequencies[frequencyIndex]);
	};

	return (
		<div className='relative mx-auto flex max-w-3xl flex-col items-center max-w'>
			<Tabs
				classNames={{
					tab: "data-[hover-unselected=true]:opacity-90",
				}}
				radius='full'
				size='lg'
				onSelectionChange={onFrequencyChange}
			>
				<Tab key={FrequencyEnum.Monthly} title='Pay Monthly' />
				<Tab
					key={FrequencyEnum.Yearly}
					aria-label='Pay Yearly'
					className='pr-1.5'
					title={
						<div className='flex items-center gap-2'>
							<p>Pay Yearly</p>
							<Chip color='primary'>2 months free</Chip>
						</div>
					}
				/>
			</Tabs>
			<Spacer y={12} />
			{/* Grid ---> "xs" to "lg" */}
			<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
				{tiers.slice(0, 2).map((tier) => (
					<Card
						key={tier.key}
						isBlurred
						className={cn("bg-background/60 p-3 dark:bg-default-100/50", {
							"!border-small border-primary/50": tier.mostPopular,
						})}
						shadow='md'
					>
						{tier.mostPopular ? (
							<Chip className='absolute right-4 top-4 bg-primary' variant='flat'>
								Most Popular
							</Chip>
						) : null}
						<CardHeader className='flex flex-col items-start gap-2 pb-6'>
							<h2 className='text-large font-medium'>{tier.title}</h2>
							<p className='text-medium text-default-500'>{tier.description}</p>
						</CardHeader>
						<Divider />
						<CardBody className='gap-8'>
							<p className='flex items-baseline gap-1 pt-2'>
								<span className='inline text-4xl font-semibold leading-7 tracking-tight'>{typeof tier.price === "string" ? tier.price : tier.price[selectedFrequency.key]}</span>
								{typeof tier.price !== "string" ? <span className='text-small font-medium text-default-400'>{tier.priceSuffix ? `/${tier.priceSuffix}/${selectedFrequency.priceSuffix}` : `/${selectedFrequency.priceSuffix}`}</span> : null}
							</p>
							<ul className='flex flex-col gap-2'>
								{tier.features?.map((feature) => (
									<li key={feature} className='flex items-center gap-2'>
										<IconCheck className='text-primary' width={24} />
										<p className='text-default-500'>{feature}</p>
									</li>
								))}
							</ul>
						</CardBody>
						<CardFooter>
							<Button fullWidth as={Link} color={tier.buttonColor} href='/login' variant={tier.buttonVariant}>
								{tier.buttonText}
							</Button>
						</CardFooter>
					</Card>
				))}
			</div>
			<Spacer y={12} />
		</div>
	);
}
