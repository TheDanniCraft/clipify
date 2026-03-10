"use client";

import { startAdminView } from "@actions/auth";
import { Button, Card, CardBody, CardHeader, Chip, Input, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { IconSearch } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type AdminExplorerRow = {
	id: string;
	username: string;
	email: string;
	role: string;
	plan: string;
	lastLoginLabel: string;
};

type AdminUserExplorerProps = {
	users: AdminExplorerRow[];
	query: string;
	page: number;
	totalPages: number;
	totalRows: number;
	firstRowNumber: number;
	lastRowNumber: number;
};

export default function AdminUserExplorer({ users, query, page, totalPages, totalRows, firstRowNumber, lastRowNumber }: AdminUserExplorerProps) {
	const router = useRouter();
	const [switchingUserId, setSwitchingUserId] = useState<string | null>(null);

	async function handleViewAsUser(userId: string) {
		setSwitchingUserId(userId);
		try {
			const result = await startAdminView(userId);
			if (!result.ok) {
				router.push(`/admin?error=${encodeURIComponent(result.error ?? "unknown")}`);
				return;
			}
			router.push("/dashboard");
			router.refresh();
		} finally {
			setSwitchingUserId(null);
		}
	}

	return (
		<Card>
			<CardHeader className='pb-1'>
				<div className='flex w-full flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
					<div>
						<p className='text-sm font-semibold'>User Explorer</p>
						<p className='text-xs text-default-500'>Search by username or user ID in one field.</p>
					</div>
					<p className='text-xs text-default-500'>
						Showing {firstRowNumber}-{lastRowNumber} of {new Intl.NumberFormat("en-US").format(totalRows)}
					</p>
				</div>
			</CardHeader>
			<CardBody className='gap-3'>
				<form action='/admin' method='get' className='flex flex-col gap-2 sm:flex-row sm:items-end'>
					<div className='sm:min-w-[320px]'>
						<Input
							id='user-explorer-search'
							name='q'
							defaultValue={query}
							placeholder='username or user id'
							label='Search users'
							labelPlacement='outside'
							size='sm'
							variant='bordered'
							startContent={<IconSearch className='text-default-400' size={16} />}
						/>
					</div>
					<Button type='submit' size='sm' color='primary' className='sm:mb-[2px]'>
						Search
					</Button>
				</form>

				<Table
					aria-label='Admin user explorer table'
					removeWrapper
					className='min-w-[900px]'
					classNames={{
						base: "overflow-x-auto rounded-lg border border-default-200",
						table: "min-w-[900px]",
						th: "border-b border-default-200 bg-default-100 text-default-700",
						tr: "transition-colors data-[hover=true]:bg-primary/15 data-[hover=true]:outline data-[hover=true]:outline-1 data-[hover=true]:outline-primary/35",
						td: "group-data-[hover=true]:text-foreground",
					}}
				>
					<TableHeader>
						<TableColumn key='username'>Username</TableColumn>
						<TableColumn key='id'>User ID</TableColumn>
						<TableColumn key='email'>Email</TableColumn>
						<TableColumn key='role'>Role</TableColumn>
						<TableColumn key='plan'>Plan</TableColumn>
						<TableColumn key='lastLogin'>Last Login</TableColumn>
						<TableColumn key='action' align='end'>
							Action
						</TableColumn>
					</TableHeader>
					<TableBody emptyContent='No users found.'>
						{users.map((row) => (
							<TableRow key={row.id}>
								<TableCell>
									<span className='font-medium'>@{row.username}</span>
								</TableCell>
								<TableCell>
									<span className='text-default-600'>{row.id}</span>
								</TableCell>
								<TableCell>
									<span className='text-default-600'>{row.email}</span>
								</TableCell>
								<TableCell>
									<Chip size='sm' variant='flat'>
										{row.role}
									</Chip>
								</TableCell>
								<TableCell>
									<Chip size='sm' variant='flat'>
										{row.plan}
									</Chip>
								</TableCell>
								<TableCell>
									<span className='text-default-600'>{row.lastLoginLabel}</span>
								</TableCell>
								<TableCell className='text-right'>
									<Button size='sm' color='primary' variant='solid' onPress={() => void handleViewAsUser(row.id)} isLoading={switchingUserId === row.id} isDisabled={switchingUserId != null}>
										View as User
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>

				<div className='flex flex-wrap items-center justify-between gap-2'>
					<form action='/admin' method='get' className='flex items-center gap-2'>
						{query ? <input type='hidden' name='q' value={query} /> : null}
						<input type='hidden' name='page' value={String(Math.max(1, page - 1))} />
						<Button type='submit' size='sm' variant='flat' isDisabled={page <= 1}>
							Previous
						</Button>
					</form>
					<p className='text-xs text-default-500'>
						Page {page} / {totalPages}
					</p>
					<form action='/admin' method='get' className='flex items-center gap-2'>
						{query ? <input type='hidden' name='q' value={query} /> : null}
						<input type='hidden' name='page' value={String(Math.min(totalPages, page + 1))} />
						<Button type='submit' size='sm' variant='flat' isDisabled={page >= totalPages}>
							Next
						</Button>
					</form>
				</div>
			</CardBody>
			</Card>
		);
}
