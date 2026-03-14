"use client";

import { getAdminExplorerPage } from "@actions/adminView";
import { startAdminView } from "@actions/auth";
import { Button, Card, CardBody, CardHeader, Chip, Input, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { IconSearch } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
	initialPage: number;
	initialTotalPages: number;
	initialTotalRows: number;
	initialQuery: string;
};

const PAGE_SIZE = 25;

function formatLastLoginLabel(value: Date | string | null) {
	if (!value) return "never";
	return new Date(value).toLocaleString();
}

export default function AdminUserExplorer({ users, initialPage, initialTotalPages, initialTotalRows, initialQuery }: AdminUserExplorerProps) {
	const router = useRouter();
	const [switchingUserId, setSwitchingUserId] = useState<string | null>(null);
	const [inputValue, setInputValue] = useState(initialQuery);
	const [searchQuery, setSearchQuery] = useState(initialQuery);
	const [page, setPage] = useState(initialPage);
	const [totalPages, setTotalPages] = useState(initialTotalPages);
	const [totalRows, setTotalRows] = useState(initialTotalRows);
	const [visibleUsers, setVisibleUsers] = useState(users);
	const [isLoading, setIsLoading] = useState(false);
	const latestRequestIdRef = useRef(0);

	const loadPage = useCallback(async (query: string, requestedPage: number) => {
		const requestId = latestRequestIdRef.current + 1;
		latestRequestIdRef.current = requestId;
		setIsLoading(true);
		try {
			const result = await getAdminExplorerPage(query, requestedPage, PAGE_SIZE);
			if (requestId !== latestRequestIdRef.current) return;
			setVisibleUsers(
				result.users.map((row) => ({
					id: row.id,
					username: row.username,
					email: row.email,
					role: row.role,
					plan: row.plan,
					lastLoginLabel: formatLastLoginLabel(row.lastLogin),
				})),
			);
			setPage(result.page);
			setTotalPages(result.totalPages);
			setTotalRows(result.totalRows);
		} finally {
			if (requestId === latestRequestIdRef.current) {
				setIsLoading(false);
			}
		}
	}, []);

	useEffect(() => {
		const nextQuery = inputValue.trim();
		const timer = setTimeout(() => {
			if (nextQuery === searchQuery) return;
			setSearchQuery(nextQuery);
			void loadPage(nextQuery, 1);
		}, 400);
		return () => clearTimeout(timer);
	}, [inputValue, searchQuery, loadPage]);

	function handlePageChange(newPage: number) {
		const nextQuery = inputValue.trim();
		setSearchQuery(nextQuery);
		void loadPage(nextQuery, newPage);
	}

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

	const firstRowNumber = totalRows === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
	const lastRowNumber = Math.min(page * PAGE_SIZE, totalRows);

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
				<div className='flex flex-col gap-2 sm:flex-row sm:items-end'>
					<div className='sm:min-w-[320px]'>
						<Input
							id='user-explorer-search'
							name='q'
							value={inputValue}
							onValueChange={setInputValue}
							placeholder='username or user id'
							label='Search users'
							labelPlacement='outside'
							size='sm'
							variant='bordered'
							startContent={<IconSearch className='text-default-400' size={16} />}
							endContent={isLoading ? <Spinner size='sm' /> : null}
						/>
					</div>
				</div>

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
						{visibleUsers.map((row) => (
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
					<Button size='sm' variant='flat' isDisabled={page <= 1 || isLoading} onPress={() => handlePageChange(page - 1)}>
						Previous
					</Button>
					<p className='text-xs text-default-500'>
						Page {page} / {totalPages}
					</p>
					<Button size='sm' variant='flat' isDisabled={page >= totalPages || isLoading} onPress={() => handlePageChange(page + 1)}>
						Next
					</Button>
				</div>
			</CardBody>
		</Card>
	);
}
