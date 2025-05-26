"use client";

import { validateAuth } from "@/app/actions/auth";
import { deleteUser } from "@/app/actions/database";
import ConfirmModal from "@/app/components/confirmModal";
import DashboardNavbar from "@/app/components/dashboardNavbar";
import { AuthenticatedUser } from "@/app/lib/types";
import { addToast, Avatar, Button, Card, CardBody, CardHeader, Divider, Snippet, Spinner, Tooltip, useDisclosure } from "@heroui/react";
import { IconInfoCircle, IconTrash } from "@tabler/icons-react";
import { redirect, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SettingsPage() {
	const [user, setUser] = useState<AuthenticatedUser | null>(null);
	const { isOpen, onOpen, onOpenChange } = useDisclosure();
	const router = useRouter();

	useEffect(() => {
		async function validateUser() {
			const user = await validateAuth();
			if (!user) {
				redirect("/logout");
			}

			setUser(user);
		}

		validateUser();
	}, []);

	if (!user) {
		return (
			<div className='flex items-center justify-center h-screen w-full'>
				<Spinner label='Loading' />
			</div>
		);
	}

	return (
		<>
			<DashboardNavbar user={user} title='Settings' tagline='Manage your settings'>
				<Card className='mt-4'>
					<CardHeader>
						<div className='flex items-center gap-2 w-full justify-end'>
							<div className=' items-center overflow-hidden'>
								<Snippet
									size='sm'
									symbol='User ID:'
									classNames={{
										pre: "overflow-hidden whitespace-nowrap",
									}}
								>
									{user.id}
								</Snippet>
							</div>
							<Tooltip content='If you contact support, please specify this user ID.'>
								<IconInfoCircle size={20} className='text-default-400' />
							</Tooltip>
						</div>
					</CardHeader>
					<CardBody className='pl-4 pr-4 pt-0'>
						<div className='flex items-center mb-4'>
							<Avatar src={user.avatar} size='lg' className='mr-4' />
							<div>
								<p className='text-2xl font-bold'>{user.username}</p>
								<p className='text-sm font-bold text-muted-foreground'>
									<span className='text-muted-foreground'>Plan:</span> <span className={`${user.plan === "free" ? "text-green-600" : "text-primary-400"} capitalize`}>{user.plan}</span>
								</p>
							</div>
						</div>
						<Divider />
						<div className='flex pt-4 gap-2 justify-end'>
							<Button color='danger' startContent={<IconTrash />} onPress={onOpen}>
								Delete Account
							</Button>
						</div>
					</CardBody>
				</Card>
			</DashboardNavbar>

			<ConfirmModal
				isOpen={isOpen}
				onOpenChange={onOpenChange}
				keyword={user.username}
				onConfirm={async () => {
					addToast({
						title: "Deleting...",
						description: "Your account is being deleted. You will be redirected soonn.",
						color: "danger",
					});

					await deleteUser(user.id);
					router.push("/logout");
				}}
			/>
		</>
	);
}
