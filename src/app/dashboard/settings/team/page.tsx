"use client";

import { validateAuth } from "@actions/auth";
import DashboardNavbar from "@components/dashboardNavbar";
import DashboardUserAvatar from "@components/dashboardUserAvatar";
import FullscreenLoadingState from "@components/fullscreenLoadingState";
import type { AuthenticatedUser } from "@types";
import { Alert, Button, Card, Chip, Input, Label, ListBox, Select, Table, TextField } from "@heroui/react";
import { IconCopy, IconLink, IconMail, IconTrash, IconUserPlus, IconUsersGroup } from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { authClient } from "@/auth/client";

type MemberRow = { id: string; role: string; user: { name: string; email: string } };
type InvitationRow = { id: string; email: string; role: string | null; status: string; expiresAt: Date | string };
type RoleRow = { id: string; role: string };
type Feedback = { status: "success" | "danger"; message: string } | null;

const STANDARD_STAFF_ROLES = ["operations", "content-manager", "analyst", "billing-manager"] as const;

function formatRole(role: string | null) {
	if (!role) return "Not assigned";
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

function RoleSelect({ ariaLabel, isDisabled, onChange, options, value }: { ariaLabel: string; isDisabled?: boolean; onChange: (role: string) => void; options: string[]; value: string }) {
	return (
		<Select aria-label={ariaLabel} className='w-full sm:w-52' isDisabled={isDisabled} value={value} variant='secondary' onChange={(next) => next != null && onChange(String(next))}>
			<Select.Trigger>
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					{options.map((option) => (
						<ListBox.Item key={option} id={option} textValue={formatRole(option)}>
							{formatRole(option)}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
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
	const [role, setRole] = useState("operations");
	const [pendingAction, setPendingAction] = useState<string | null>(null);
	const [isLoadingTeam, setIsLoadingTeam] = useState(true);
	const [feedback, setFeedback] = useState<Feedback>(null);
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
		if (organizations.isPending) return;
		if (!organization) return;
		let active = true;
		void Promise.all([authClient.organization.listMembers({ query: { organizationId: organization.id, limit: 100 } }), authClient.organization.listInvitations({ query: { organizationId: organization.id } }), authClient.organization.listRoles({ query: { organizationId: organization.id } })])
			.then(([memberResult, invitationResult, roleResult]) => {
				if (!active) return;
				setMembers((memberResult.data?.members ?? []) as MemberRow[]);
				setInvitations((invitationResult.data ?? []) as InvitationRow[]);
				setCustomRoles((roleResult.data ?? []) as RoleRow[]);
			})
			.catch(() => {
				if (active) setFeedback({ status: "danger", message: "Team access could not be loaded. Refresh the page and try again." });
			})
			.finally(() => {
				if (active) setIsLoadingTeam(false);
			});
		return () => {
			active = false;
		};
	}, [organization, organizations.isPending]);

	const roleOptions = useMemo(() => [...new Set([...STANDARD_STAFF_ROLES, ...customRoles.map((candidate) => candidate.role)])], [customRoles]);

	async function invite(delivery: "copy" | "copy-and-email") {
		if (!organization || !email.trim()) return;
		setPendingAction(`invite-${delivery}`);
		setFeedback(null);
		setInvitationUrl("");
		try {
			const response = await fetch("/api/team/invitations", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ organizationId: organization.id, organizationName: organization.name, email, role, delivery }),
			});
			const result = (await response.json()) as { invitationUrl?: string; error?: string };
			if (!response.ok || !result.invitationUrl) throw new Error(result.error ?? "INVITATION_NOT_CREATED");
			setInvitationUrl(result.invitationUrl);
			setFeedback({ status: "success", message: delivery === "copy-and-email" ? "Invitation created and emailed." : "Invitation created. Copy the link below and share it securely." });
			setEmail("");
			await refresh();
		} catch {
			setFeedback({ status: "danger", message: "The invitation could not be created. Check your permission and try again." });
		} finally {
			setPendingAction(null);
		}
	}

	async function updateMemberRole(memberId: string, nextRole: string) {
		if (!organization) return;
		setPendingAction(`role-${memberId}`);
		setFeedback(null);
		try {
			const result = await authClient.organization.updateMemberRole({ organizationId: organization.id, memberId, role: nextRole });
			if (result.error) throw new Error("ROLE_NOT_UPDATED");
			setFeedback({ status: "success", message: "Member role updated." });
			await refresh();
		} catch {
			setFeedback({ status: "danger", message: "The member role could not be updated." });
		} finally {
			setPendingAction(null);
		}
	}

	async function removeMember(memberId: string) {
		if (!organization) return;
		setPendingAction(`remove-${memberId}`);
		setFeedback(null);
		try {
			const result = await authClient.organization.removeMember({ organizationId: organization.id, memberIdOrEmail: memberId });
			if (result.error) throw new Error("MEMBER_NOT_REMOVED");
			setFeedback({ status: "success", message: "Member removed." });
			await refresh();
		} catch {
			setFeedback({ status: "danger", message: "The member could not be removed." });
		} finally {
			setPendingAction(null);
		}
	}

	async function copyInvitationLink() {
		try {
			await navigator.clipboard.writeText(invitationUrl);
			setFeedback({ status: "success", message: "Invitation link copied to your clipboard." });
		} catch {
			setFeedback({ status: "danger", message: "The invitation link could not be copied. Select the link and copy it manually." });
		}
	}

	if (!user || organizations.isPending) return <FullscreenLoadingState message='Loading team settings' />;

	return (
		<DashboardNavbar user={user} title='Team members' tagline='Invite people and control what they can manage'>
			<div className='mt-6 flex w-full flex-col gap-6 pb-10'>
				{feedback ? (
					<Alert status={feedback.status}>
						<Alert.Content>
							<Alert.Description>{feedback.message}</Alert.Description>
						</Alert.Content>
					</Alert>
				) : null}

				{!organization ? (
					<Card>
						<Card.Header>
							<Card.Title>No creator account available</Card.Title>
							<Card.Description>This identity is not connected to a creator account that has Team management.</Card.Description>
						</Card.Header>
					</Card>
				) : (
					<>
						<Card>
							<Card.Header className='gap-3'>
								<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
									<IconUserPlus aria-hidden='true' size={20} />
								</div>
								<div>
									<Card.Title>Invite a team member</Card.Title>
									<Card.Description>Give someone access to {organization.name}. Team members sign in with their own verified email and do not need to connect Twitch.</Card.Description>
								</div>
							</Card.Header>
							<Card.Content className='flex flex-col gap-5'>
								<div className='grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]'>
									<TextField type='email' value={email} onChange={setEmail} isRequired>
										<Label>Account email</Label>
										<Input placeholder='person@example.com' variant='secondary' />
									</TextField>
									<Select fullWidth isRequired value={role} variant='secondary' onChange={(next) => next != null && setRole(String(next))}>
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
											</ListBox>
										</Select.Popover>
									</Select>
								</div>
								<div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
									<Button variant='secondary' isPending={pendingAction === "invite-copy"} isDisabled={pendingAction !== null || !email.trim()} onPress={() => void invite("copy")}>
										<IconLink aria-hidden='true' size={18} />
										Create copyable link
									</Button>
									<Button variant='primary' isPending={pendingAction === "invite-copy-and-email"} isDisabled={pendingAction !== null || !email.trim()} onPress={() => void invite("copy-and-email")}>
										<IconMail aria-hidden='true' size={18} />
										Create and email
									</Button>
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
							</Card.Content>
						</Card>

						<Card>
							<Card.Header className='gap-3'>
								<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
									<IconUsersGroup aria-hidden='true' size={20} />
								</div>
								<div>
									<Card.Title>Current members</Card.Title>
									<Card.Description>Owners have full access. Change a team member&apos;s role or remove their access at any time.</Card.Description>
								</div>
							</Card.Header>
							<Card.Content>
								<Table variant='secondary'>
									<Table.ScrollContainer>
										<Table.Content aria-label='Current team members' className='min-w-[720px]'>
											<Table.Header>
												<Table.Column isRowHeader>Member</Table.Column>
												<Table.Column>Role</Table.Column>
												<Table.Column className='text-end'>Action</Table.Column>
											</Table.Header>
											<Table.Body renderEmptyState={() => <div className='p-6 text-center text-sm text-muted'>{isLoadingTeam ? "Loading members…" : "No members found."}</div>}>
												{members.map((member) => {
													const isOwner = member.role === "owner";
													const memberRoles = [...new Set([member.role, ...roleOptions])];
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
																{isOwner ? (
																	<Chip color='accent' size='sm' variant='soft'>
																		Owner
																	</Chip>
																) : (
																	<RoleSelect ariaLabel={`Role for ${member.user.email}`} isDisabled={pendingAction !== null} options={memberRoles} value={member.role} onChange={(nextRole) => void updateMemberRole(member.id, nextRole)} />
																)}
															</Table.Cell>
															<Table.Cell className='text-right'>
																{isOwner ? (
																	<span className='text-sm text-muted'>Full access</span>
																) : (
																	<Button size='sm' variant='danger-soft' isPending={pendingAction === `remove-${member.id}`} isDisabled={pendingAction !== null} onPress={() => void removeMember(member.id)}>
																		<IconTrash aria-hidden='true' size={16} />
																		Remove
																	</Button>
																)}
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

						<Card>
							<Card.Header>
								<Card.Title>Pending invitations</Card.Title>
								<Card.Description>Invitation links are single-use and expire automatically.</Card.Description>
							</Card.Header>
							<Card.Content>
								<Table variant='secondary'>
									<Table.ScrollContainer>
										<Table.Content aria-label='Pending team invitations' className='min-w-[640px]'>
											<Table.Header>
												<Table.Column isRowHeader>Email</Table.Column>
												<Table.Column>Role</Table.Column>
												<Table.Column>Expires</Table.Column>
												<Table.Column>Status</Table.Column>
											</Table.Header>
											<Table.Body renderEmptyState={() => <div className='p-6 text-center text-sm text-muted'>{isLoadingTeam ? "Loading invitations…" : "No pending invitations."}</div>}>
												{invitations.map((invitation) => (
													<Table.Row key={invitation.id} id={invitation.id} textValue={invitation.email}>
														<Table.Cell>
															<span className='font-medium'>{invitation.email}</span>
														</Table.Cell>
														<Table.Cell>{formatRole(invitation.role)}</Table.Cell>
														<Table.Cell>
															<span className='text-sm text-muted'>{formatExpiration(invitation.expiresAt)}</span>
														</Table.Cell>
														<Table.Cell>
															<Chip color={invitation.status === "pending" ? "warning" : "default"} size='sm' variant='soft'>
																{formatRole(invitation.status)}
															</Chip>
														</Table.Cell>
													</Table.Row>
												))}
											</Table.Body>
										</Table.Content>
									</Table.ScrollContainer>
								</Table>
							</Card.Content>
						</Card>
					</>
				)}
			</div>
		</DashboardNavbar>
	);
}
