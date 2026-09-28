"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Label, TextField } from "@heroui/react";
import { authClient } from "@/auth/client";
import { PERMISSIONS, type Permission } from "@/auth/permissions";
import { useSearchParams } from "next/navigation";

type RoleRow = { id: string; role: string; permission: Record<string, string[]> };

function groupPermissions(permissions: readonly Permission[]) {
	const grouped: Record<string, string[]> = {};
	for (const permission of permissions) {
		const [resource, action] = permission.split(":");
		(grouped[resource] ??= []).push(action);
	}
	return grouped;
}

export default function RoleSettingsPage() {
	const organizations = authClient.useListOrganizations();
	const requestedOrganizationId = useSearchParams().get("organization");
	const organization = organizations.data?.find((candidate) => candidate.id === requestedOrganizationId) ?? organizations.data?.[0];
	const [roles, setRoles] = useState<RoleRow[]>([]);
	const [name, setName] = useState("");
	const [selected, setSelected] = useState<Permission[]>([]);
	const [message, setMessage] = useState("");

	const refresh = useMemo(
		() => async () => {
			if (!organization) return;
			const result = await authClient.organization.listRoles({ query: { organizationId: organization.id } });
			setRoles((result.data ?? []) as RoleRow[]);
		},
		[organization],
	);

	useEffect(() => {
		if (!organization) return;
		let active = true;
		void authClient.organization.listRoles({ query: { organizationId: organization.id } }).then((result) => {
			if (active) setRoles((result.data ?? []) as RoleRow[]);
		});
		return () => {
			active = false;
		};
	}, [organization]);

	async function createRole() {
		if (!organization || !name.trim() || selected.length === 0) return;
		const slug = name
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 64);
		const result = await authClient.organization.createRole({ organizationId: organization.id, role: slug, permission: groupPermissions(selected) });
		setMessage(result.error ? "Role could not be created." : "Role created.");
		if (!result.error) {
			setName("");
			setSelected([]);
			await refresh();
		}
	}

	return (
		<main className='mx-auto flex w-full max-w-6xl flex-col gap-6 p-6'>
			<header>
				<p className='text-sm text-muted'>Settings</p>
				<h1 className='text-2xl font-semibold'>Roles and permissions</h1>
				<p className='text-sm text-muted'>Custom roles are scoped to {organization?.name ?? "the selected account"}. Account deletion, ownership transfer, agency provisioning, forced purge, and restore authorization cannot be delegated.</p>
			</header>
			<Card>
				<Card.Header>
					<Card.Title>Create a custom role</Card.Title>
				</Card.Header>
				<Card.Content className='flex flex-col gap-4'>
					<TextField value={name} onChange={setName}>
						<Label>Role name</Label>
						<Input placeholder='Playlist producer' />
					</TextField>
					<div className='grid gap-3 md:grid-cols-2 lg:grid-cols-3'>
						{PERMISSIONS.map((permission) => (
							<label key={permission} className='flex items-center gap-2 rounded-lg border border-default p-3 text-sm'>
								<input type='checkbox' checked={selected.includes(permission)} onChange={(event) => setSelected((current) => (event.target.checked ? [...current, permission] : current.filter((item) => item !== permission)))} />
								{permission}
							</label>
						))}
					</div>
					<div>
						<Button variant='primary' onPress={() => void createRole()}>
							Create role
						</Button>
					</div>
					{message && <p className='text-sm'>{message}</p>}
				</Card.Content>
			</Card>
			<Card>
				<Card.Header>
					<Card.Title>Custom roles</Card.Title>
				</Card.Header>
				<Card.Content>
					<ul className='divide-y divide-default'>
						{roles.map((role) => (
							<li key={role.id} className='py-3'>
								<strong>{role.role}</strong>
								<p className='text-sm text-muted'>
									{Object.entries(role.permission)
										.flatMap(([resource, actions]) => actions.map((action) => `${resource}:${action}`))
										.join(", ")}
								</p>
							</li>
						))}
					</ul>
				</Card.Content>
			</Card>
		</main>
	);
}
