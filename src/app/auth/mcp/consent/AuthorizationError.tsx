"use client";
import { Card } from "@heroui/react";
import { IconCircleX } from "@tabler/icons-react";
import { AuthorizationLayout } from "./AuthorizationLayout";

type ErrorCardProps = { role?: "alert"; title?: string; description?: string };

export function AuthorizationErrorCard({ role = "alert", title = "Invalid authorization request", description = "Restart the connection from your app." }: ErrorCardProps) {
	return (
		<Card role={role} className='p-6 sm:p-8'>
			<Card.Header className='items-center gap-3 py-7 text-center'>
				<IconCircleX size={48} className='text-danger' aria-hidden='true' />
				<h1 className='text-2xl font-semibold'>{title}</h1>
				<Card.Description>{description}</Card.Description>
			</Card.Header>
		</Card>
	);
}

export function AuthorizationError(props: ErrorCardProps) {
	return (
		<AuthorizationLayout>
			<AuthorizationErrorCard {...props} />
		</AuthorizationLayout>
	);
}
