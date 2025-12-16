"use client";

import type { Selection, SortDescriptor } from "@heroui/react";
import type { ColumnsKey } from "./data";
import type { Overlay, StatusOptions, TwitchUserResponse } from "@types";
import type { Key } from "@react-types/shared";

import dynamic from "next/dynamic";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input, Button, RadioGroup, Radio, Chip, Pagination, Divider, Tooltip, Popover, PopoverTrigger, PopoverContent, Spinner, addToast, Link, Avatar, Skeleton } from "@heroui/react";
const Table = dynamic(() => import("@heroui/react").then((c) => c.Table), { ssr: false }); // Temp fix for issue 4385
import React, { useMemo, useCallback, useState, useEffect } from "react";
import { cn } from "@heroui/react";
import { IconAdjustmentsHorizontal, IconArrowsLeftRight, IconChevronDown, IconChevronUp, IconCirclePlus, IconCircuitChangeover, IconInfoCircle, IconMenuDeep, IconPencil, IconReload, IconSearch, IconTrash } from "@tabler/icons-react";
import { createOverlay, deleteOverlay, saveOverlay, getAllOverlays, getUserPlan, getEditorOverlays, getEditorAccess } from "@actions/database";

import { CopyText } from "./copy-text";

import { useMemoizedCallback } from "./use-memoized-callback";

import { columns, INITIAL_VISIBLE_COLUMNS } from "./data";
import { Status } from "./Status";
import { useRouter } from "next/navigation";
import { getAvatar, getUsersDetailsBulk } from "@/app/actions/twitch";

export default function OverlayTable({ userId, accessToken }: { userId: string; accessToken: string }) {
	const router = useRouter();
	type LocalOverlay = Overlay & { aType?: "owner" | "editor" };

	const [overlays, setOverlays] = useState<LocalOverlay[]>();
	const [filterValue, setFilterValue] = useState("");
	const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set([]));
	const [visibleColumns, setVisibleColumns] = useState<Selection>(new Set(INITIAL_VISIBLE_COLUMNS));
	const [rowsPerPage] = useState(10);
	const [page, setPage] = useState(1);
	const [isLoading, setIsLoading] = useState(false);
	const [hasAccess, setHasAccess] = useState<boolean>(false);
	const [editorAccessList, setEditorAccessList] = useState<Set<TwitchUserResponse>>(new Set());
	const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
		column: "memberInfo",
		direction: "ascending",
	});

	const [statusFilter, setStatusFilter] = React.useState("all");

	const handleOverlayClick = useMemoizedCallback(() => {
		setSortDescriptor({
			column: "name",
			direction: sortDescriptor.direction === "ascending" ? "descending" : "ascending",
		});
	});

	useEffect(() => {
		async function fetchOverlays() {
			try {
				const overlaysData = await getAllOverlays(userId);
				const editorOverlays = await getEditorOverlays(userId);

				const combinedOverlays: Overlay[] = [...(overlaysData ?? []).map((o) => ({ ...o, aType: "owner" as const })), ...(editorOverlays ?? []).map((o) => ({ ...o, aType: "editor" as const }))];

				setOverlays(combinedOverlays ?? undefined);
			} catch (error) {
				console.error("Failed to fetch overlays:", error);
			}
		}

		async function fetchEditorAccess() {
			const editors = await getEditorAccess(userId);
			if (editors && editors.length > 0) {
				setHasAccess(true);

				const editorDetails = await getUsersDetailsBulk({ userIds: [userId, ...editors.map((e) => e.userId)], accessToken });

				setEditorAccessList(new Set(editorDetails));
			} else {
				setHasAccess(false);
			}
		}

		fetchOverlays();
		fetchEditorAccess();
	}, [accessToken, userId]);

	const headerColumns = useMemo(() => {
		if (visibleColumns === "all") return columns;

		return columns
			.map((item) => {
				if (item.uid === sortDescriptor.column) {
					return {
						...item,
						sortDirection: sortDescriptor.direction,
					};
				}

				return item;
			})
			.filter((column) => Array.from(visibleColumns).includes(column.uid));
	}, [visibleColumns, sortDescriptor]);

	const itemFilter = useCallback(
		(col: Overlay) => {
			const allStatus = statusFilter === "all";

			return allStatus || statusFilter === col.status.toLowerCase();
		},
		[statusFilter]
	);

	const filteredItems = useMemo(() => {
		let filteredProjects = [...(overlays || [])];

		if (filterValue) {
			filteredProjects = filteredProjects.filter((project) => project.name.toLowerCase().includes(filterValue.toLowerCase()));
		}

		filteredProjects = filteredProjects.filter(itemFilter);

		return filteredProjects;
	}, [filterValue, overlays, itemFilter]);

	const pages = Math.ceil(filteredItems.length / rowsPerPage) || 1;

	const items = useMemo(() => {
		const start = (page - 1) * rowsPerPage;
		const end = start + rowsPerPage;

		return filteredItems.slice(start, end);
	}, [page, filteredItems, rowsPerPage]);

	const sortedItems = useMemo(() => {
		return [...items].sort((a: LocalOverlay, b: LocalOverlay) => {
			const col = sortDescriptor.column as keyof Overlay;

			let first = a[col];
			let second = b[col];

			if (col === "name" || col === "status") {
				first = a[col];
				second = b[col];
			}

			const safeFirst = first ?? "";
			const safeSecond = second ?? "";
			const cmp = safeFirst < safeSecond ? -1 : safeFirst > safeSecond ? 1 : 0;

			return sortDescriptor.direction === "descending" ? -cmp : cmp;
		});
	}, [sortDescriptor, items]);

	const filterSelectedKeys = useMemo(() => {
		if (selectedKeys === "all") return selectedKeys;
		let resultKeys = new Set<Key>();

		if (filterValue) {
			filteredItems.forEach((item) => {
				const stringId = String(item.id);

				if ((selectedKeys as Set<string>).has(stringId)) {
					resultKeys.add(stringId);
				}
			});
		} else {
			resultKeys = selectedKeys;
		}

		return resultKeys;
	}, [selectedKeys, filteredItems, filterValue]);

	const getOverlayInfoProps = useMemoizedCallback(() => ({
		onClick: handleOverlayClick,
	}));

	const renderCell = useMemoizedCallback((overlay: LocalOverlay, columnKey: React.Key) => {
		const overlayKey = columnKey as ColumnsKey;

		const cellValue = overlay[overlayKey as unknown as keyof Overlay] as string;

		switch (overlayKey) {
			case "aType":
				return <AvatarCell ownerId={overlay.ownerId} userId={userId} />;
			case "name":
			case "id":
				return <CopyText>{cellValue}</CopyText>;
			case "status":
				return <Status status={cellValue as StatusOptions} />;
			case "actions":
				return (
					<div className='flex items-center justify-end gap-2'>
						<IconPencil className='cursor-pointer text-default-400' height={18} width={18} />
						<IconTrash
							className='cursor-pointer text-default-400'
							height={18}
							width={18}
							onClick={(event) => {
								event.stopPropagation();

								deleteOverlay(overlay)
									.then(() => {
										setOverlays((prev) => (prev ? prev.filter((o) => o.id !== overlay.id) : []));

										addToast({
											title: "Successfully deleted",
											description: `Overlay "${overlay.name}" has been deleted.`,
											color: "success",
										});
									})
									.catch(() => {
										addToast({
											title: "Error",
											description: "An error occurred while deleting the overlay.",
											color: "danger",
										});
									});
							}}
						/>
					</div>
				);
			default:
				return cellValue;
		}
	});

	const onNextPage = useMemoizedCallback(() => {
		if (page < pages) {
			setPage(page + 1);
		}
	});

	const onPreviousPage = useMemoizedCallback(() => {
		if (page > 1) {
			setPage(page - 1);
		}
	});

	const onSearchChange = useMemoizedCallback((value?: string) => {
		if (value) {
			setFilterValue(value);
			setPage(1);
		} else {
			setFilterValue("");
		}
	});

	const onSelectionChange = useMemoizedCallback((keys: Selection) => {
		if (keys === "all") {
			if (filterValue) {
				const resultKeys = new Set(filteredItems.map((item) => String(item.id)));

				setSelectedKeys(resultKeys);
			} else {
				setSelectedKeys(keys);
			}
		} else if (keys.size === 0) {
			setSelectedKeys(new Set());
		} else {
			const resultKeys = new Set<Key>();

			keys.forEach((v) => {
				resultKeys.add(v);
			});
			const selectedValue = selectedKeys === "all" ? new Set(filteredItems.map((item) => String(item.id))) : selectedKeys;

			selectedValue.forEach((v) => {
				if (items.some((item) => String(item.id) === v)) {
					return;
				}
				resultKeys.add(v);
			});
			setSelectedKeys(new Set(resultKeys));
		}
	});

	const reloadOverlays = useMemoizedCallback(async () => {
		const overlaysData = await getAllOverlays(userId);
		const editorOverlays = await getEditorOverlays(userId);

		const combinedOverlays: Overlay[] = [...(overlaysData ?? []).map((o) => ({ ...o, aType: "owner" as const })), ...(editorOverlays ?? []).map((o) => ({ ...o, aType: "editor" as const }))];

		setOverlays(combinedOverlays ?? undefined);
	});

	const topContent = useMemo(() => {
		return (
			<div className='flex items-center gap-4 overflow-auto px-[6px] py-[4px]'>
				<div className='flex items-center gap-3'>
					<div className='flex items-center gap-4'>
						<Input className='min-w-[200px]' endContent={<IconSearch className='text-default-400' width={16} />} placeholder='Search' size='sm' value={filterValue} onValueChange={onSearchChange} />
						<div>
							<Popover placement='bottom'>
								<PopoverTrigger>
									<Button className='bg-default-100 text-default-800' size='sm' startContent={<IconAdjustmentsHorizontal className='text-default-400' width={16} />} aria-label='Open Filter Options'>
										Filter
									</Button>
								</PopoverTrigger>
								<PopoverContent className='w-80'>
									<div className='flex w-full flex-col gap-6 px-2 py-4'>
										<RadioGroup label='Status' value={statusFilter} onValueChange={setStatusFilter}>
											<Radio value='all'>All</Radio>
											<Radio value='active'>Active</Radio>
											<Radio value='paused'>Paused</Radio>
										</RadioGroup>
									</div>
								</PopoverContent>
							</Popover>
						</div>
						<div>
							<Dropdown>
								<DropdownTrigger>
									<Button className='bg-default-100 text-default-800' size='sm' startContent={<IconMenuDeep className='text-default-400' width={16} />} aria-label='Open Sort Options'>
										Sort
									</Button>
								</DropdownTrigger>
								<DropdownMenu aria-label='Sort' items={headerColumns.filter((c) => !["actions"].includes(c.uid))}>
									{(item) =>
										item.name === "" ? null : (
											<DropdownItem
												key={item.uid}
												onPress={() => {
													setSortDescriptor({
														column: item.uid,
														direction: sortDescriptor.direction === "ascending" ? "descending" : "ascending",
													});
												}}
											>
												{item.name}
											</DropdownItem>
										)
									}
								</DropdownMenu>
							</Dropdown>
						</div>
						<div>
							<Dropdown closeOnSelect={false}>
								<DropdownTrigger>
									<Button className='bg-default-100 text-default-800' size='sm' startContent={<IconArrowsLeftRight className='text-default-400' width={16} />} aria-label='Open Column Options'>
										Columns
									</Button>
								</DropdownTrigger>
								<DropdownMenu disallowEmptySelection aria-label='Columns' items={columns.filter((c) => !["actions"].includes(c.uid))} selectedKeys={visibleColumns} selectionMode='multiple' onSelectionChange={setVisibleColumns}>
									{(item) => (item.name === "" ? null : <DropdownItem key={item.uid}>{item.name}</DropdownItem>)}
								</DropdownMenu>
							</Dropdown>
						</div>
					</div>

					<Divider className='h-5' orientation='vertical' />

					<div className='whitespace-nowrap text-sm text-default-800'>{filterSelectedKeys === "all" ? "All items selected" : `${filterSelectedKeys.size} Selected`}</div>

					{(filterSelectedKeys === "all" || filterSelectedKeys.size > 0) && (
						<Dropdown>
							<DropdownTrigger>
								<Button className='bg-default-100 text-default-800' endContent={<IconChevronDown className='text-default-400' />} size='sm' variant='flat' aria-label='Open Selected Actions'>
									Selected Actions
								</Button>
							</DropdownTrigger>
							<DropdownMenu aria-label='Selected Actions'>
								<DropdownItem
									key='toggleStatus'
									startContent={<IconCircuitChangeover />}
									onClick={() => {
										const selectedOverlays = filterSelectedKeys === "all" ? overlays : filteredItems.filter((item) => filterSelectedKeys.has(String(item.id)));

										const toggleStatusPromises = selectedOverlays?.map((overlay) => {
											const newStatus = overlay.status === "active" ? "paused" : "active";
											return saveOverlay({ ...overlay, status: newStatus }).then(() => {
												setOverlays((prev) => (prev ? prev.map((o) => (o.id === overlay.id ? { ...o, status: newStatus } : o)) : []));
											});
										});

										Promise.all(toggleStatusPromises ?? [])
											.then(() => {
												addToast({
													title: "Status Updated",
													description: `${selectedOverlays?.length ?? 0} Overlay${(selectedOverlays?.length ?? 0) > 1 ? "s" : ""} status have been updated.`,
													color: "success",
												});
											})
											.catch(() => {
												addToast({
													title: "Error",
													description: "An error occurred while updating the status of one or more overlays.",
													color: "danger",
												});
											});
									}}
								>
									Toggle status
								</DropdownItem>
								<DropdownItem
									key='delete'
									color='danger'
									startContent={<IconTrash className='text-danger-500' width={16} />}
									onClick={() => {
										const selectedOverlays = filterSelectedKeys === "all" ? overlays : filteredItems.filter((item) => filterSelectedKeys.has(String(item.id)));

										const deletePromises = selectedOverlays?.map((overlay) =>
											deleteOverlay(overlay).then(() => {
												setOverlays((prev) => (prev ? prev.filter((o) => o.id !== overlay.id) : []));
											})
										);

										Promise.all(deletePromises ?? [])
											.then(() => {
												setSelectedKeys(new Set([]));
												addToast({
													title: "Successfully deleted",
													description: `${selectedOverlays?.length ?? 0} Overlay${(selectedOverlays?.length ?? 0) > 1 ? "s" : ""} have been deleted.`,
													color: "success",
												});
											})
											.catch(() => {
												addToast({
													title: "Error",
													description: "An error occurred while deleting one or more overlays.",
													color: "danger",
												});
											});
									}}
								>
									Delete
								</DropdownItem>
							</DropdownMenu>
						</Dropdown>
					)}
				</div>
			</div>
		);
	}, [filterValue, visibleColumns, filterSelectedKeys, headerColumns, sortDescriptor, statusFilter, setStatusFilter, onSearchChange, setVisibleColumns, filteredItems, overlays]);

	const topBar = useMemo(() => {
		return (
			<div className='mb-[12px] flex items-center justify-between'>
				<div className='flex w-[226px] items-center gap-2'>
					<h1 className='text-2xl font-[700] leading-[32px]'>Overlays</h1>
					<Chip className='hidden items-center text-default-500 sm:flex' size='sm' variant='flat'>
						{overlays?.length ?? 0}
					</Chip>
					<Button isIconOnly size='sm' variant='light' onPress={reloadOverlays} startContent={<IconReload className='text-default-400' width={16} />} aria-label='Reload Overlays' />
				</div>
				{hasAccess ? (
					<Dropdown>
						<DropdownTrigger>
							<Button color='primary' isDisabled={overlays === undefined} isLoading={isLoading} endContent={<IconCirclePlus width={20} />}>
								Add Overlay
							</Button>
						</DropdownTrigger>

						<DropdownMenu aria-label='Overlay actions' items={editorAccessList}>
							{(item) => (
								<DropdownItem
									key={item.id}
									onPress={async () => {
										setIsLoading(true);

										const plan = await getUserPlan(userId);
										const overlaysCount = overlays?.length ?? 0;

										if (plan === "free" && overlaysCount >= 1) {
											addToast({
												title: "Upgrade Required",
												description: (
													<p>
														To add an additional overlay, please{" "}
														<Link color='warning' underline='always' href='/dashboard/settings'>
															upgrade
														</Link>{" "}
														to <strong>Pro</strong>.
													</p>
												),
												color: "warning",
											});
											setIsLoading(false);
											return;
										}

										const overlay = await createOverlay(item.id);
										router.push(`/dashboard/overlay/${overlay.id}`);
									}}
								>
									<div className='flex items-center'>
										<Avatar className='mr-2 h-6 w-6' src={item.profile_image_url} />
										Add new overlay for {item.display_name}
									</div>
								</DropdownItem>
							)}
						</DropdownMenu>
					</Dropdown>
				) : (
					<Button
						color='primary'
						endContent={<IconCirclePlus width={20} />}
						isLoading={isLoading}
						isDisabled={overlays === undefined}
						onPress={async () => {
							setIsLoading(true);

							const plan = await getUserPlan(userId);
							const overlaysCount = overlays?.length ?? 0;

							if (plan === "free" && overlaysCount >= 1) {
								addToast({
									title: "Upgrade Required",
									description: (
										<p>
											To add an additional overlay, please{" "}
											<Link color='warning' underline='always' href='/dashboard/settings'>
												upgrade
											</Link>{" "}
											to <strong>Pro</strong>.
										</p>
									),
									color: "warning",
								});
								setIsLoading(false);
								return;
							}

							createOverlay(userId).then((overlay) => {
								router.push(`/dashboard/overlay/${overlay.id}`);
							});
						}}
					>
						Add Overlay
					</Button>
				)}
			</div>
		);
	}, [overlays, reloadOverlays, router, userId, isLoading, hasAccess, editorAccessList]);

	const bottomContent = useMemo(() => {
		return (
			<div className='flex flex-col items-center justify-between gap-2 px-2 py-2 sm:flex-row'>
				<Pagination isCompact showControls showShadow color='primary' page={page} total={pages} onChange={setPage} />
				<div className='flex items-center justify-end gap-6'>
					<span className='text-small text-default-400'>{filterSelectedKeys === "all" ? "All items selected" : `${filterSelectedKeys.size} of ${filteredItems.length} selected`}</span>
					<div className='flex items-center gap-3'>
						<Button isDisabled={page === 1} size='sm' variant='flat' onPress={onPreviousPage} aria-label='Previous Page'>
							Previous
						</Button>
						<Button isDisabled={page === pages} size='sm' variant='flat' onPress={onNextPage} aria-label='Next Page'>
							Next
						</Button>
					</div>
				</div>
			</div>
		);
	}, [filterSelectedKeys, page, pages, filteredItems.length, onPreviousPage, onNextPage]);

	return (
		<div className='h-full w-full p-6'>
			{topBar}
			<Table
				isHeaderSticky
				aria-label='Example table with custom cells, pagination and sorting'
				bottomContent={bottomContent}
				bottomContentPlacement='outside'
				classNames={{
					td: "before:bg-transparent",
				}}
				selectedKeys={filterSelectedKeys}
				selectionMode='multiple'
				sortDescriptor={sortDescriptor}
				topContent={topContent}
				topContentPlacement='outside'
				onSelectionChange={onSelectionChange}
				onSortChange={setSortDescriptor}
				onRowAction={(key) => {
					router.push(`/dashboard/overlay/${key}`);
				}}
			>
				<TableHeader columns={headerColumns}>
					{(column) => (
						<TableColumn key={column.uid} align={column.uid === "actions" ? "end" : "start"} className={cn([column.uid === "actions" ? "flex items-center justify-end px-[20px]" : ""])}>
							{column.uid === "name" ? (
								<div {...getOverlayInfoProps()} className='flex w-full cursor-pointer items-center justify-between'>
									{column.name}
									{column.sortDirection === "ascending" ? <IconChevronUp className='text-default-400' /> : <IconChevronDown className='text-default-400' />}
								</div>
							) : column.info ? (
								<div className='flex min-w-[108px] items-center justify-between'>
									{column.name}
									<Tooltip content={column.info}>
										<IconInfoCircle className='text-default-300' height={16} width={16} />
									</Tooltip>
								</div>
							) : (
								column.name
							)}
						</TableColumn>
					)}
				</TableHeader>
				<TableBody emptyContent={overlays === undefined ? <Spinner label='Loading overlays' /> : <div className='text-default-400'>No overlays found</div>} items={sortedItems}>
					{(item) => <TableRow key={item.id}>{(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}</TableRow>}
				</TableBody>
			</Table>
		</div>
	);
}

function AvatarCell({ ownerId, userId }: { ownerId: string; userId: string }) {
	const [src, setSrc] = React.useState<string | null>(null);
	const [loading, setLoading] = React.useState(true);

	React.useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				const url = await getAvatar(ownerId, userId);
				if (!cancelled) setSrc(url ?? null);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [ownerId]);

	return (
		<Skeleton isLoaded={!loading} className='rounded-full'>
			<Avatar size='sm' src={src ?? undefined} fallback />
		</Skeleton>
	);
}
