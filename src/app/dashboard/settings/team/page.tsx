"use client";

import { validateAuth } from "@actions/auth";
import DashboardNavbar from "@components/dashboardNavbar";
import DashboardUserAvatar from "@components/dashboardUserAvatar";
import FullscreenLoadingState from "@components/fullscreenLoadingState";
import SettingsNavigation from "@components/settingsNavigation";
import type { AuthenticatedUser } from "@types";
import { Button, Card, Checkbox, Chip, Input, Label, ListBox, Modal, Select, Table, TextField } from "@heroui/react";
import { notify as addToast } from "@lib/toast";
import { IconCopy, IconLink, IconMail, IconPencil, IconShieldCheck, IconTrash, IconUserPlus, IconUsersGroup } from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { authClient } from "@/auth/client";
import { PERMISSIONS, STANDARD_ROLES, type Permission } from "@/auth/permissions";

type MemberRow = { id: string; role: string; user: { name: string; email: string } };
type InvitationRow = { id: string; email: string; role: string | null; status: string; expiresAt: Date | string };
type RoleRow = { id: string; role: string; permission: Record<string, string[]> };
type TeamRow = { kind: "member"; member: MemberRow } | { kind: "invitation"; invitation: InvitationRow };

const STANDARD_STAFF_ROLES = ["operations", "content-manager", "analyst", "billing-manager"] as const;
const CUSTOM_ROLE = "custom";

const STANDARD_ROLE_PERMISSIONS: Record<(typeof STANDARD_STAFF_ROLES)[number], readonly Permission[]> = {
	operations: STANDARD_ROLES.operations,
	"content-manager": STANDARD_ROLES.contentManager,
	analyst: STANDARD_ROLES.analyst,
	"billing-manager": STANDARD_ROLES.billingManager,
};

function formatRole(role: string | null) {
	if (!role) return "Not assigned";
	if (role.startsWith("custom-access-")) return "Custom";
	return role
		.split("-")
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

function formatExpiration(value: Date | string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Unknown";
	return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function groupPermissions(permissions: readonly Permission[]) {
	const grouped: Record<string, string[]> = {};
	for (const permission of permissions) {
		const [resource, action] = permission.split(":");
		(grouped[resource] ??= []).push(action);
	}
	return grouped;
}

function permissionGroups(permissions: readonly Permission[]) {
	const grouped: Record<string, Permission[]> = {};
	for (const permission of permissions) {
		const [resource] = permission.split(":");
		(grouped[resource] ??= []).push(permission);
	}
	return grouped;
}

const PERMISSION_GROUPS = Object.entries(permissionGroups(PERMISSIONS));

function formatPermissionGroup(resource: string) {
	return resource
		.split("-")
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

function flattenPermissions(permission: Record<string, string[]>) {
	return Object.entries(permission)
		.flatMap(([resource, actions]) => actions.map((action) => `${resource}:${action}`))
		.filter((permission): permission is Permission => PERMISSIONS.includes(permission as Permission));
}

function customRoleName(permissions: readonly Permission[]) {
	let hash = 2166136261;
	for (const character of [...permissions].sort().join("|")) {
		hash ^= character.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return `custom-access-${(hash >>> 0).toString(36)}`;
}

export default function TeamSettingsPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const organizations = authClient.useListOrganizations();
	const requestedOrganizationId = searchParams.get("organization");
	const organization = organizations.data?.find((candidate) => candidate.id === requestedOrganizationId) ?? organizations.data?.[0];
	const [user, setUser] = useState<AuthenticatedUser | null>(null);
	const [members, setMembers] = useState<MemberRow[]>([]);
	const [invitations, setInvitations] = useState<InvitationRow[]>([]);
	const [customRoles, setCustomRoles] = useState<RoleRow[]>([]);
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<string>("operations");
	const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([...STANDARD_ROLES.operations]);
	const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
	const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
	const [pendingAction, setPendingAction] = useState<string | null>(null);
	const [isLoadingTeam, setIsLoadingTeam] = useState(true);
	const [invitationUrl, setInvitationUrl] = useState("");

	useEffect(() => {
		let active = true;
		async function validateUser() {
			const authenticatedUser = await validateAuth();
			if (!active) return;
			if (!authenticatedUser) {
				router.push("/logout");
				return;
			}
			setUser(authenticatedUser);
		}
		void validateUser();
		return () => {
			active = false;
		};
	}, [router]);

	const refresh = useCallback(async () => {
		if (!organization) return;
		const [memberResult, invitationResult, roleResult] = await Promise.all([authClient.organization.listMembers({ query: { organizationId: organization.id, limit: 100 } }), authClient.organization.listInvitations({ query: { organizationId: organization.id } }), authClient.organization.listRoles({ query: { organizationId: organization.id } })]);
		setMembers((memberResult.data?.members ?? []) as MemberRow[]);
		setInvitations((invitationResult.data ?? []) as InvitationRow[]);
		setCustomRoles((roleResult.data ?? []) as RoleRow[]);
	}, [organization]);

	useEffect(() => {
		if (organizations.isPending || !organization) return;
		let active = true;
		void Promise.all([authClient.organization.listMembers({ query: { organizationId: organization.id, limit: 100 } }), authClient.organization.listInvitations({ query: { organizationId: organization.id } }), authClient.organization.listRoles({ query: { organizationId: organization.id } })])
			.then(([memberResult, invitationResult, roleResult]) => {
				if (!active) return;
				setMembers((memberResult.data?.members ?? []) as MemberRow[]);
				setInvitations((invitationResult.data ?? []) as InvitationRow[]);
				setCustomRoles((roleResult.data ?? []) as RoleRow[]);
			})
			.catch(() => active && addToast({ title: "Team could not be loaded", description: "Refresh the page and try again.", color: "danger" }))
			.finally(() => {
				if (active) setIsLoadingTeam(false);
			});
		return () => {
			active = false;
		};
	}, [organization, organizations.isPending]);

	const visibleCustomRoles = useMemo(() => customRoles.filter((candidate) => candidate.role !== CUSTOM_ROLE && !candidate.role.startsWith("custom-access-")), [customRoles]);
	const roleOptions = useMemo(() => [...new Set([...STANDARD_STAFF_ROLES, ...visibleCustomRoles.map((candidate) => candidate.role)])], [visibleCustomRoles]);
	const teamRows = useMemo<TeamRow[]>(() => [...members.map((member) => ({ kind: "member" as const, member })), ...invitations.filter((invitation) => invitation.status === "pending").map((invitation) => ({ kind: "invitation" as const, invitation }))], [invitations, members]);

	function permissionsForRole(nextRole: string) {
		if (nextRole in STANDARD_ROLE_PERMISSIONS) return [...STANDARD_ROLE_PERMISSIONS[nextRole as keyof typeof STANDARD_ROLE_PERMISSIONS]];
		return flattenPermissions(customRoles.find((candidate) => candidate.role === nextRole)?.permission ?? {});
	}

	function resetAccessEditor() {
		setEditingMember(null);
		setEmail("");
		setRole("operations");
		setSelectedPermissions([...STANDARD_ROLES.operations]);
		setInvitationUrl("");
	}

	function openInvitationEditor() {
		resetAccessEditor();
		setIsAccessModalOpen(true);
	}

	function openMemberEditor(member: MemberRow) {
		setEditingMember(member);
		setEmail(member.user.email);
		setRole(member.role.startsWith("custom-access-") ? CUSTOM_ROLE : member.role);
		setSelectedPermissions(permissionsForRole(member.role));
		setInvitationUrl("");
		setIsAccessModalOpen(true);
	}

	function selectRole(nextRole: string) {
		setRole(nextRole);
		if (nextRole !== CUSTOM_ROLE) setSelectedPermissions(permissionsForRole(nextRole));
	}

	function togglePermission(permission: Permission, isSelected: boolean) {
		setSelectedPermissions((current) => (isSelected ? [...new Set([...current, permission])] : current.filter((item) => item !== permission)));
		setRole(CUSTOM_ROLE);
	}

	function togglePermissionGroup(group: readonly Permission[], isSelected: boolean) {
		setSelectedPermissions((current) => (isSelected ? [...new Set([...current, ...group])] : current.filter((permission) => !group.includes(permission))));
		setRole(CUSTOM_ROLE);
	}

	async function resolveRole() {
		if (!organization) throw new Error("ORGANIZATION_REQUIRED");
		if (role !== CUSTOM_ROLE) return { role, createdRoleId: null as string | null };
		if (selectedPermissions.length === 0) throw new Error("PERMISSIONS_REQUIRED");

		const generatedRole = customRoleName(selectedPermissions);
		const existing = customRoles.find((candidate) => candidate.role === generatedRole);
		if (existing) return { role: existing.role, createdRoleId: null as string | null };

		const result = await authClient.organization.createRole({ organizationId: organization.id, role: generatedRole, permission: groupPermissions(selectedPermissions) });
		if (result.error || !result.data?.roleData) throw new Error("CUSTOM_ROLE_NOT_CREATED");
		return { role: generatedRole, createdRoleId: result.data.roleData.id };
	}

	async function invite(delivery: "copy" | "copy-and-email") {
		if (!organization || !email.trim() || selectedPermissions.length === 0) return;
		setPendingAction(`invite-${delivery}`);
		setInvitationUrl("");
		let createdRoleId: string | null = null;
		try {
			const resolved = await resolveRole();
			createdRoleId = resolved.createdRoleId;
			const response = await fetch("/api/team/invitations", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ organizationId: organization.id, organizationName: organization.name, email, role: resolved.role, delivery }),
			});
			const result = (await response.json()) as { invitationUrl?: string; error?: string };
			if (!response.ok || !result.invitationUrl) throw new Error(result.error ?? "INVITATION_NOT_CREATED");
			setInvitationUrl(result.invitationUrl);
			addToast({ title: "Invitation created", description: delivery === "copy-and-email" ? "The invitation was also sent by email." : "Copy the link and share it securely.", color: "success" });
			setEmail("");
			await refresh();
		} catch {
			if (createdRoleId) await authClient.organization.deleteRole({ organizationId: organization.id, roleId: createdRoleId });
			addToast({ title: "Invitation could not be created", description: "Check your permission and try again.", color: "danger" });
		} finally {
			setPendingAction(null);
		}
	}

	async function saveMemberAccess() {
		if (!organization || !editingMember || selectedPermissions.length === 0) return;
		setPendingAction(`role-${editingMember.id}`);
		let createdRoleId: string | null = null;
		try {
			const resolved = await resolveRole();
			createdRoleId = resolved.createdRoleId;
			const result = await authClient.organization.updateMemberRole({ organizationId: organization.id, memberId: editingMember.id, role: resolved.role });
			if (result.error) throw new Error("ROLE_NOT_UPDATED");
			addToast({ title: "Member access updated", color: "success" });
			setIsAccessModalOpen(false);
			resetAccessEditor();
			await refresh();
		} catch {
			if (createdRoleId) await authClient.organization.deleteRole({ organizationId: organization.id, roleId: createdRoleId });
			addToast({ title: "Member access could not be updated", color: "danger" });
		} finally {
			setPendingAction(null);
		}
	}

	async function removeMember(memberId: string) {
		if (!organization) return;
		setPendingAction(`remove-${memberId}`);
		try {
			const result = await authClient.organization.removeMember({ organizationId: organization.id, memberIdOrEmail: memberId });
			if (result.error) throw new Error("MEMBER_NOT_REMOVED");
			addToast({ title: "Member removed", color: "success" });
			await refresh();
		} catch {
			addToast({ title: "Member could not be removed", color: "danger" });
		} finally {
			setPendingAction(null);
		}
	}

	async function revokeInvitation(invitationId: string) {
		setPendingAction(`revoke-${invitationId}`);
		try {
			const result = await authClient.organization.cancelInvitation({ invitationId });
			if (result.error) throw new Error("INVITATION_NOT_REVOKED");
			addToast({ title: "Invitation revoked", color: "success" });
			await refresh();
		} catch {
			addToast({ title: "Invitation could not be revoked", color: "danger" });
		} finally {
			setPendingAction(null);
		}
	}

	async function copyInvitationLink() {
		try {
			await navigator.clipboard.writeText(invitationUrl);
			addToast({ title: "Invitation link copied", color: "success" });
		} catch {
			addToast({ title: "Invitation link could not be copied", description: "Select the link and copy it manually.", color: "danger" });
		}
	}

	if (!user || organizations.isPending) return <FullscreenLoadingState message='Loading team settings' />;

	return (
		<DashboardNavbar user={user} title='Team members' tagline='Invite people and control what they can manage'>
			<div className='mt-6 flex w-full flex-col gap-6 pb-10'>
				<SettingsNavigation active='team' />
				{!organization ? (
					<Card>
						<Card.Header>
							<Card.Title>No creator account available</Card.Title>
							<Card.Description>This identity is not connected to a creator account that has Team management.</Card.Description>
						</Card.Header>
					</Card>
				) : (
					<Card>
						<Card.Header className='flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between'>
							<div className='flex items-center gap-3'>
								<div className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent'>
									<IconUsersGroup aria-hidden='true' size={20} />
								</div>
								<div>
									<Card.Title>{organization.name}</Card.Title>
									<Card.Description>Manage active members and pending invitations from one place.</Card.Description>
								</div>
							</div>
							<Button variant='primary' onPress={openInvitationEditor}>
								<IconUserPlus aria-hidden='true' size={18} />
								Invite member
							</Button>
						</Card.Header>
						<Card.Content>
							<Table variant='secondary'>
								<Table.ScrollContainer>
									<Table.Content aria-label='Team members and invitations' className='min-w-[760px]'>
										<Table.Header>
											<Table.Column isRowHeader>Member</Table.Column>
											<Table.Column>Access</Table.Column>
											<Table.Column>Status</Table.Column>
											<Table.Column className='text-end'>Actions</Table.Column>
										</Table.Header>
										<Table.Body renderEmptyState={() => <div className='p-8 text-center text-sm text-muted'>{isLoadingTeam ? "Loading team…" : "No team members or pending invitations."}</div>}>
											{teamRows.map((row) => {
												if (row.kind === "invitation") {
													const { invitation } = row;
													return (
														<Table.Row key={`invitation-${invitation.id}`} id={`invitation-${invitation.id}`} textValue={invitation.email} className='opacity-65'>
															<Table.Cell>
																<div className='flex items-center gap-3'>
																	<div className='flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-muted'>
																		<IconMail aria-hidden='true' size={17} />
																	</div>
																	<div className='min-w-0'>
																		<p className='truncate font-medium'>{invitation.email}</p>
																		<p className='text-xs text-muted'>Expires {formatExpiration(invitation.expiresAt)}</p>
																	</div>
																</div>
															</Table.Cell>
															<Table.Cell>{formatRole(invitation.role)}</Table.Cell>
															<Table.Cell>
																<Chip color='warning' size='sm' variant='soft'>
																	Pending invitation
																</Chip>
															</Table.Cell>
															<Table.Cell>
																<div className='flex justify-end gap-1'>
																	<Button isIconOnly size='sm' variant='secondary' isDisabled aria-label={`Edit invitation for ${invitation.email}`}>
																		<IconPencil aria-hidden='true' size={16} />
																	</Button>
																	<Button isIconOnly size='sm' variant='danger-soft' isPending={pendingAction === `revoke-${invitation.id}`} isDisabled={pendingAction !== null} aria-label={`Revoke invitation for ${invitation.email}`} onPress={() => void revokeInvitation(invitation.id)}>
																		<IconTrash aria-hidden='true' size={16} />
																	</Button>
																</div>
															</Table.Cell>
														</Table.Row>
													);
												}

												const { member } = row;
												const isOwner = member.role === "owner";
												return (
													<Table.Row key={member.id} id={member.id} textValue={member.user.name || member.user.email}>
														<Table.Cell>
															<div className='flex items-center gap-3'>
																<DashboardUserAvatar username={member.user.name || member.user.email} avatar='' />
																<div className='min-w-0'>
																	<p className='truncate font-medium'>{member.user.name || member.user.email}</p>
																	<p className='truncate text-sm text-muted'>{member.user.email}</p>
																</div>
															</div>
														</Table.Cell>
														<Table.Cell>
															<div className='flex items-center gap-2'>
																<IconShieldCheck aria-hidden='true' className='text-muted' size={17} />
																<span>{formatRole(member.role)}</span>
															</div>
														</Table.Cell>
														<Table.Cell>
															<Chip color={isOwner ? "accent" : "success"} size='sm' variant='soft'>
																{isOwner ? "Owner" : "Active"}
															</Chip>
														</Table.Cell>
														<Table.Cell>
															<div className='flex justify-end gap-1'>
																<Button isIconOnly size='sm' variant='secondary' isDisabled={isOwner || pendingAction !== null} aria-label={`Edit access for ${member.user.email}`} onPress={() => openMemberEditor(member)}>
																	<IconPencil aria-hidden='true' size={16} />
																</Button>
																<Button isIconOnly size='sm' variant='danger-soft' isPending={pendingAction === `remove-${member.id}`} isDisabled={isOwner || pendingAction !== null} aria-label={`Remove ${member.user.email}`} onPress={() => void removeMember(member.id)}>
																	<IconTrash aria-hidden='true' size={16} />
																</Button>
															</div>
														</Table.Cell>
													</Table.Row>
												);
											})}
										</Table.Body>
									</Table.Content>
								</Table.ScrollContainer>
							</Table>
						</Card.Content>
					</Card>
				)}
			</div>

			<Modal>
				<Modal.Backdrop
					isOpen={isAccessModalOpen}
					onOpenChange={(isOpen) => {
						if (pendingAction) return;
						setIsAccessModalOpen(isOpen);
						if (!isOpen) resetAccessEditor();
					}}
					variant='blur'
				>
					<Modal.Container size='lg' scroll='inside' className='max-w-4xl'>
						<Modal.Dialog aria-labelledby='team-access-heading'>
							<Modal.CloseTrigger />
							<Modal.Header className='items-center gap-3 border-b border-default'>
								<Modal.Icon className='bg-accent-soft text-accent-soft-foreground'>{editingMember ? <IconShieldCheck aria-hidden='true' size={22} /> : <IconUserPlus aria-hidden='true' size={22} />}</Modal.Icon>
								<div>
									<Modal.Heading id='team-access-heading'>{editingMember ? "Edit member access" : "Invite a team member"}</Modal.Heading>
									<p className='text-sm text-muted'>{editingMember ? "Choose a role or fine-tune this member’s permissions." : `Give someone access to ${organization?.name ?? "this account"}.`}</p>
								</div>
							</Modal.Header>
							<Modal.Body className='gap-6 py-5'>
								<div className='flex flex-col gap-4'>
									<TextField type='email' value={email} onChange={setEmail} isRequired isReadOnly={Boolean(editingMember)}>
										<Label>Account email</Label>
										<Input placeholder='person@example.com' variant='secondary' />
									</TextField>
									<Select fullWidth isRequired value={role} variant='secondary' onChange={(next) => next != null && selectRole(String(next))}>
										<Label>Role</Label>
										<Select.Trigger>
											<Select.Value />
											<Select.Indicator />
										</Select.Trigger>
										<Select.Popover>
											<ListBox>
												{roleOptions.map((option) => (
													<ListBox.Item key={option} id={option} textValue={formatRole(option)}>
														{formatRole(option)}
														<ListBox.ItemIndicator />
													</ListBox.Item>
												))}
												<ListBox.Item id={CUSTOM_ROLE} textValue='Custom'>
													Custom
													<ListBox.ItemIndicator />
												</ListBox.Item>
											</ListBox>
										</Select.Popover>
									</Select>
								</div>

								<div>
									<div className='mb-3 flex flex-wrap items-end justify-between gap-2'>
										<div>
											<p className='font-semibold'>Permissions</p>
											<p className='text-sm text-muted'>Changing any permission automatically switches the role to Custom.</p>
										</div>
										<Chip color={role === CUSTOM_ROLE ? "accent" : "default"} size='sm' variant='soft'>
											{selectedPermissions.length} selected
										</Chip>
									</div>
									<div className='grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3'>
										{PERMISSION_GROUPS.map(([resource, resourcePermissions]) => {
											const selectedCount = resourcePermissions.filter((permission) => selectedPermissions.includes(permission)).length;
											const isGroupSelected = selectedCount === resourcePermissions.length;
											const isGroupIndeterminate = selectedCount > 0 && !isGroupSelected;

											return (
												<div key={resource} className='min-w-0'>
													<Checkbox isSelected={isGroupSelected} isIndeterminate={isGroupIndeterminate} onChange={(checked) => togglePermissionGroup(resourcePermissions, checked)}>
														<Checkbox.Content>
															<Checkbox.Control>
																<Checkbox.Indicator />
															</Checkbox.Control>
															<span className='font-semibold'>{formatPermissionGroup(resource)}</span>
														</Checkbox.Content>
													</Checkbox>
													<div className='mt-2 flex flex-col gap-2 border-l border-default pl-3'>
														{resourcePermissions.map((permission) => (
															<Checkbox key={permission} isSelected={selectedPermissions.includes(permission)} onChange={(checked) => togglePermission(permission, checked)}>
																<Checkbox.Content>
																	<Checkbox.Control>
																		<Checkbox.Indicator />
																	</Checkbox.Control>
																	<span className='truncate font-mono text-xs'>{permission.replace(":", ".")}</span>
																</Checkbox.Content>
															</Checkbox>
														))}
													</div>
												</div>
											);
										})}
									</div>
								</div>

								{invitationUrl ? (
									<div className='rounded-2xl bg-surface-secondary p-4'>
										<p className='mb-2 text-sm font-semibold'>Shareable invitation link</p>
										<div className='flex flex-col gap-2 sm:flex-row'>
											<Input readOnly value={invitationUrl} aria-label='Invitation link' variant='secondary' className='min-w-0 flex-1' />
											<Button variant='secondary' onPress={() => void copyInvitationLink()}>
												<IconCopy aria-hidden='true' size={18} />
												Copy link
											</Button>
										</div>
									</div>
								) : null}
							</Modal.Body>
							<Modal.Footer className='flex-col gap-2 border-t border-default sm:flex-row sm:justify-end'>
								<Button variant='tertiary' isDisabled={pendingAction !== null} onPress={() => setIsAccessModalOpen(false)}>
									Cancel
								</Button>
								{editingMember ? (
									<Button variant='primary' isPending={pendingAction === `role-${editingMember.id}`} isDisabled={pendingAction !== null || selectedPermissions.length === 0} onPress={() => void saveMemberAccess()}>
										<IconShieldCheck aria-hidden='true' size={18} />
										Save access
									</Button>
								) : (
									<>
										<Button variant='secondary' isPending={pendingAction === "invite-copy"} isDisabled={pendingAction !== null || !email.trim() || selectedPermissions.length === 0} onPress={() => void invite("copy")}>
											<IconLink aria-hidden='true' size={18} />
											Create link
										</Button>
										<Button variant='primary' isPending={pendingAction === "invite-copy-and-email"} isDisabled={pendingAction !== null || !email.trim() || selectedPermissions.length === 0} onPress={() => void invite("copy-and-email")}>
											<IconMail aria-hidden='true' size={18} />
											Create and email
										</Button>
									</>
								)}
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</DashboardNavbar>
	);
}
