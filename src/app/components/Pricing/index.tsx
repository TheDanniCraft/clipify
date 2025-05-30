"use client";

import React from "react";
import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Divider, Link, Spacer } from "@heroui/react";
import { cn } from "@heroui/react";

import { tiers } from "./pricing-tiers";
import { IconCheck } from "@tabler/icons-react";

export default function TiersComponent() {
	return (
		<div className='relative mx-auto flex max-w-3xl flex-col items-cente max-w'>
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
								<span className='inline text-4xl font-semibold leading-7 tracking-tight'>{tier.price}</span>
								{typeof tier.price !== "string" && tier.priceSuffix ? <span className='text-small font-medium text-default-400'>/{tier.priceSuffix}</span> : null}
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
							<Button fullWidth as={Link} color='primary' href='/login' variant={tier.buttonVariant}>
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
