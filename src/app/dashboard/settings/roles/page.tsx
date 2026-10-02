"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Checkbox, Chip, Input, Label, TextField } from "@heroui/react";
import { IconKey, IconLockAccess, IconPlus, IconShieldCheck } from "@tabler/icons-react";
import { validateAuth } from "@actions/auth";
import DashboardNavbar from "@components/dashboardNavbar";
import FullscreenLoadingState from "@components/fullscreenLoadingState";
import type { AuthenticatedUser } from "@types";
import { authClient } from "@/auth/client";
import { PERMISSIONS, type Permission } from "@/auth/permissions";

type RoleRow = { id: string; role: string; permission: Record<string, string[]> };
type Feedback = { status: "success" | "danger"; message: string } | null;

function title(value: string) {
	return value
		.split("-")
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

function groupPermissions(permissions: readonly Permission[]) {
	const grouped: Record<string, string[]> = {};
	for (const permission of permissions) {
		const [resource, action] = permission.split(":");
		(grouped[resource] ??= []).push(action);
	}
	return grouped;
}

const PERMISSION_GROUPS = Object.entries(groupPermissions(PERMISSIONS));

export default function RoleSettingsPage() {
	const router = useRouter();
	const organizations = authClient.useListOrganizations();
	const requestedOrganizationId = useSearchParams().get("organization");
	const organization = organizations.data?.find((candidate) => candidate.id === requestedOrganizationId) ?? organizations.data?.[0];
	const [user, setUser] = useState<AuthenticatedUser | null>(null);
	const [roles, setRoles] = useState<RoleRow[]>([]);
	const [name, setName] = useState("");
	const [selected, setSelected] = useState<Permission[]>([]);
	const [feedback, setFeedback] = useState<Feedback>(null);
	const [isLoadingRoles, setIsLoadingRoles] = useState(true);
	const [isCreating, setIsCreating] = useState(false);

	useEffect(() => {
		let active = true;
		void validateAuth().then((authenticatedUser) => {
			if (!active) return;
			if (!authenticatedUser) return router.push("/logout");
			setUser(authenticatedUser);
		});
		return () => {
			active = false;
		};
	}, [router]);

	const refresh = useCallback(async () => {
		if (!organization) return;
		const result = await authClient.organization.listRoles({ query: { organizationId: organization.id } });
		if (result.error) throw new Error("ROLES_NOT_LOADED");
		setRoles((result.data ?? []) as RoleRow[]);
	}, [organization]);

	useEffect(() => {
		if (organizations.isPending) return;
		if (!organization) return;
		let active = true;
		void authClient.organization
			.listRoles({ query: { organizationId: organization.id } })
			.then((result) => {
				if (!active) return;
				if (result.error) throw new Error("ROLES_NOT_LOADED");
				setRoles((result.data ?? []) as RoleRow[]);
			})
			.catch(() => active && setFeedback({ status: "danger", message: "Roles could not be loaded. Refresh the page and try again." }))
			.finally(() => active && setIsLoadingRoles(false));
		return () => {
			active = false;
		};
	}, [organization, organizations.isPending]);

	const selectedByResource = useMemo(() => groupPermissions(selected), [selected]);

	function togglePermission(permission: Permission, isSelected: boolean) {
		setSelected((current) => (isSelected ? [...new Set([...current, permission])] : current.filter((item) => item !== permission)));
	}

	async function createRole() {
		if (!organization || !name.trim() || selected.length === 0) return;
		setIsCreating(true);
		setFeedback(null);
		const slug = name
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 64);
		try {
			const result = await authClient.organization.createRole({ organizationId: organization.id, role: slug, permission: selectedByResource });
			if (result.error) throw new Error("ROLE_NOT_CREATED");
			setName("");
			setSelected([]);
			setFeedback({ status: "success", message: "Custom role created." });
			await refresh();
		} catch {
			setFeedback({ status: "danger", message: "The role could not be created. Check your permissions and try again." });
		} finally {
			setIsCreating(false);
		}
	}

	if (!user || organizations.isPending) return <FullscreenLoadingState message='Loading roles and permissions' />;

	return (
		<DashboardNavbar user={user} title='Roles and permissions' tagline='Build precise access profiles for your team'>
			<div className='mt-6 flex flex-col gap-6 pb-10'>
				{feedback ? (
					<Alert status={feedback.status}>
						<Alert.Content>
							<Alert.Description>{feedback.message}</Alert.Description>
						</Alert.Content>
					</Alert>
				) : null}
				<Card variant='secondary'>
					<Card.Header className='gap-3'>
						<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
							<IconShieldCheck aria-hidden='true' size={21} />
						</div>
						<div>
							<Card.Title>Permission boundaries</Card.Title>
							<Card.Description>Custom roles apply only inside {organization?.name ?? "the selected account"}. Ownership transfer, account deletion, restore, forced purge, and agency provisioning always stay with the owner or Clipify administration.</Card.Description>
						</div>
					</Card.Header>
				</Card>

				{!organization ? (
					<Card>
						<Card.Header>
							<Card.Title>No account available</Card.Title>
							<Card.Description>Connect a creator account before creating team roles.</Card.Description>
						</Card.Header>
					</Card>
				) : (
					<>
						<Card>
							<Card.Header className='gap-3'>
								<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
									<IconPlus aria-hidden='true' size={20} />
								</div>
								<div>
									<Card.Title>Create a custom role</Card.Title>
									<Card.Description>Name the role, then choose exactly which resources and actions it can use.</Card.Description>
								</div>
							</Card.Header>
							<Card.Content className='flex flex-col gap-5'>
								<TextField value={name} onChange={setName} isRequired>
									<Label>Role name</Label>
									<Input placeholder='Playlist producer' variant='secondary' />
								</TextField>
								<div className='grid gap-4 lg:grid-cols-2'>
									{PERMISSION_GROUPS.map(([resource, actions]) => (
										<fieldset key={resource} className='rounded-2xl bg-surface-secondary p-4'>
											<legend className='px-1 text-sm font-semibold'>{title(resource)}</legend>
											<div className='mt-2 grid gap-2 sm:grid-cols-2'>
												{actions.map((action) => {
													const permission = `${resource}:${action}` as Permission;
													return (
														<Checkbox key={permission} isSelected={selected.includes(permission)} onChange={(checked) => togglePermission(permission, checked)}>
															{title(action)}
														</Checkbox>
													);
												})}
											</div>
										</fieldset>
									))}
								</div>
								<div className='flex flex-col gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between'>
									<p className='text-sm text-muted'>
										{selected.length} permission{selected.length === 1 ? "" : "s"} selected
									</p>
									<Button variant='primary' isPending={isCreating} isDisabled={isCreating || !name.trim() || selected.length === 0} onPress={() => void createRole()}>
										<IconPlus aria-hidden='true' size={18} />
										Create role
									</Button>
								</div>
							</Card.Content>
						</Card>

						<Card>
							<Card.Header className='gap-3'>
								<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
									<IconKey aria-hidden='true' size={20} />
								</div>
								<div>
									<Card.Title>Custom roles</Card.Title>
									<Card.Description>Reusable permission sets available when inviting or updating team members.</Card.Description>
								</div>
							</Card.Header>
							<Card.Content className='grid gap-3 md:grid-cols-2'>
								{roles.length === 0 ? (
									<div className='col-span-full rounded-2xl bg-surface-secondary p-6 text-center text-sm text-muted'>{isLoadingRoles ? "Loading roles…" : "No custom roles yet."}</div>
								) : (
									roles.map((role) => {
										const permissions = Object.entries(role.permission).flatMap(([resource, actions]) => actions.map((action) => `${resource}:${action}`));
										return (
											<div key={role.id} className='rounded-2xl bg-surface-secondary p-4'>
												<div className='mb-3 flex items-center justify-between gap-3'>
													<div className='flex items-center gap-2 font-semibold'>
														<IconLockAccess aria-hidden='true' size={18} />
														{title(role.role)}
													</div>
													<Chip size='sm' variant='soft'>
														{permissions.length} permissions
													</Chip>
												</div>
												<div className='flex flex-wrap gap-1.5'>
													{permissions.slice(0, 8).map((permission) => (
														<Chip key={permission} size='sm' variant='secondary'>
															{permission}
														</Chip>
													))}
													{permissions.length > 8 ? (
														<Chip size='sm' color='accent' variant='soft'>
															+{permissions.length - 8} more
														</Chip>
													) : null}
												</div>
											</div>
										);
									})
								)}
							</Card.Content>
						</Card>
					</>
				)}
			</div>
		</DashboardNavbar>
	);
}
