"use client";

import { getAdminExplorerPage } from "@actions/adminView";
import { startAdminView } from "@actions/auth";
import { Button, Card, Chip, Spinner, Table, TextField, Label, InputGroup } from "@heroui/react";

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

	useEffect(() => {
		// Re-sync local table/search state when the route is re-rendered with new server payload.
		latestRequestIdRef.current += 1;
		setInputValue(initialQuery);
		setSearchQuery(initialQuery);
		setPage(initialPage);
		setTotalPages(initialTotalPages);
		setTotalRows(initialTotalRows);
		setVisibleUsers(users);
		setIsLoading(false);
	}, [users, initialPage, initialTotalPages, initialTotalRows, initialQuery]);

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
			<Card.Header className='pb-1'>
				<div className='flex w-full flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
					<div>
						<p className='text-sm font-semibold'>User Explorer</p>
						<p className='text-xs text-muted'>Search by username or user ID in one field.</p>
					</div>
					<p className='text-xs text-muted'>
						Showing {firstRowNumber}-{lastRowNumber} of {new Intl.NumberFormat("en-US").format(totalRows)}
					</p>
				</div>
			</Card.Header>
			<Card.Content className='gap-3'>
				<div className='flex flex-col gap-2 sm:flex-row sm:items-end'>
					<div className='sm:min-w-[320px]'>
						<TextField name='q'><Label>Search users</Label><InputGroup variant='secondary'><InputGroup.Prefix>{<IconSearch className='text-muted' size={16} />}</InputGroup.Prefix><InputGroup.Input id='user-explorer-search' value={inputValue} onChange={(event) => (setInputValue)(event.target.value)} placeholder='username or user id' className='h-8 text-sm' /><InputGroup.Suffix>{isLoading ? <Spinner size='sm' /> : null}</InputGroup.Suffix></InputGroup></TextField>
					</div>
				</div>

				<Table className='rounded-lg border border-default'>
					<Table.ScrollContainer>
						<Table.Content aria-label='Admin user explorer table' className='min-w-[900px]'>
					<Table.Header>
						<Table.Column id='username' isRowHeader>Username</Table.Column>
						<Table.Column id='id'>User ID</Table.Column>
						<Table.Column id='email'>Email</Table.Column>
						<Table.Column id='role'>Role</Table.Column>
						<Table.Column id='plan'>Plan</Table.Column>
						<Table.Column id='lastLogin'>Last Login</Table.Column>
						<Table.Column id='action' className='text-end'>
							Action
						</Table.Column>
					</Table.Header>
					<Table.Body renderEmptyState={() => <div className='p-4 text-center text-muted'>No users found.</div>}>
						{visibleUsers.map((row) => (
							<Table.Row key={row.id} id={row.id}>
								<Table.Cell>
									<span className='font-medium'>@{row.username}</span>
								</Table.Cell>
								<Table.Cell>
									<span className='text-muted'>{row.id}</span>
								</Table.Cell>
								<Table.Cell>
									<span className='text-muted'>{row.email}</span>
								</Table.Cell>
								<Table.Cell>
									<Chip size='sm' variant='tertiary'>
										{row.role}
									</Chip>
								</Table.Cell>
								<Table.Cell>
									<Chip size='sm' variant='tertiary'>
										{row.plan}
									</Chip>
								</Table.Cell>
								<Table.Cell>
									<span className='text-muted'>{row.lastLoginLabel}</span>
								</Table.Cell>
								<Table.Cell className='text-right'>
									<Button size='sm' variant='primary' onPress={() => void handleViewAsUser(row.id)} isPending={switchingUserId === row.id} isDisabled={switchingUserId != null}>
										View as User
									</Button>
								</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>

				<div className='flex flex-wrap items-center justify-between gap-2'>
					<Button size='sm' variant='tertiary' isDisabled={page <= 1 || isLoading} onPress={() => handlePageChange(page - 1)}>
						Previous
					</Button>
					<p className='text-xs text-muted'>
						Page {page} / {totalPages}
					</p>
					<Button size='sm' variant='tertiary' isDisabled={page >= totalPages || isLoading} onPress={() => handlePageChange(page + 1)}>
						Next
					</Button>
				</div>
			</Card.Content>
		</Card>
	);
}
