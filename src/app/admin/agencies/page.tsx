import { redirect } from "next/navigation";
import { IconBuildingBank, IconCheck, IconFileDescription, IconMail, IconPlus, IconUsers } from "@tabler/icons-react";
import { validateAdminAuth } from "@actions/auth";
import { getAdminAgenciesAction, provisionAgencyFormAction } from "@/app/actions/agency";
import DashboardNavbar from "@components/dashboardNavbar";
import { Alert, Button, Card, Chip, Input, Label, Table, TextField } from "@components/heroui-client";

export const dynamic = "force-dynamic";

function label(value: string) {
	return value
		.split("_")
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

export default async function AdminAgenciesPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string }> }) {
	const user = await validateAdminAuth(true);
	if (!user) redirect("/dashboard");
	const [agencies, params] = await Promise.all([getAdminAgenciesAction(), searchParams]);

	return (
		<DashboardNavbar user={user} title='Agency accounts' tagline='Provision negotiated contracts and creator seat limits'>
			<div className='mt-6 flex flex-col gap-6 pb-10'>
				{params.error ? (
					<Alert status='danger'>
						<Alert.Content>
							<Alert.Title>Provisioning failed</Alert.Title>
							<Alert.Description>{label(params.error)}</Alert.Description>
						</Alert.Content>
					</Alert>
				) : null}
				{params.created ? (
					<Alert status='success'>
						<IconCheck aria-hidden='true' />
						<Alert.Content>
							<Alert.Description>Agency account and owner invitation created.</Alert.Description>
						</Alert.Content>
					</Alert>
				) : null}

				<Alert status='accent'>
					<IconFileDescription aria-hidden='true' />
					<Alert.Content>
						<Alert.Title>Contact-sales provisioning</Alert.Title>
						<Alert.Description>Create an agency only after custom commercial terms are agreed. Creator seats represent sponsored creator Pro allocations; agency staff never consume them.</Alert.Description>
					</Alert.Content>
				</Alert>

				<Card>
					<Card.Header className='gap-3'>
						<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
							<IconPlus aria-hidden='true' size={20} />
						</div>
						<div>
							<Card.Title>Provision an agency</Card.Title>
							<Card.Description>Create the organization, contract seat ceiling, and first owner invitation in one operation.</Card.Description>
						</div>
					</Card.Header>
					<Card.Content>
						<form action={provisionAgencyFormAction} className='grid gap-4 md:grid-cols-2'>
							<TextField name='name' isRequired>
								<Label>Agency name</Label>
								<Input variant='secondary' placeholder='Northstar Management' />
							</TextField>
							<TextField name='ownerEmail' type='email' isRequired>
								<Label>First owner email</Label>
								<Input variant='secondary' placeholder='owner@agency.example' />
							</TextField>
							<TextField name='commercialReference'>
								<Label>Commercial reference</Label>
								<Input variant='secondary' placeholder='Contract or CRM reference' />
							</TextField>
							<TextField name='creatorSeatLimit' type='number' isRequired>
								<Label>Creator seats</Label>
								<Input variant='secondary' min={0} placeholder='20' />
							</TextField>
							<div className='md:col-span-2 flex justify-end border-t border-default pt-4'>
								<Button type='submit' variant='primary'>
									<IconMail aria-hidden='true' size={18} />
									Provision and invite owner
								</Button>
							</div>
						</form>
					</Card.Content>
				</Card>

				<div className='grid gap-4 md:grid-cols-3'>
					<Card variant='secondary'>
						<Card.Header>
							<Card.Description>Provisioned agencies</Card.Description>
							<Card.Title className='text-3xl'>{agencies.length}</Card.Title>
						</Card.Header>
					</Card>
					<Card variant='secondary'>
						<Card.Header>
							<Card.Description>Active agencies</Card.Description>
							<Card.Title className='text-3xl'>{agencies.filter(({ account }) => account.status === "active").length}</Card.Title>
						</Card.Header>
					</Card>
					<Card variant='secondary'>
						<Card.Header>
							<Card.Description>Contracted seats</Card.Description>
							<Card.Title className='text-3xl'>{agencies.reduce((total, { account }) => total + account.creatorSeatLimit, 0)}</Card.Title>
						</Card.Header>
					</Card>
				</div>

				<Card>
					<Card.Header className='gap-3'>
						<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
							<IconBuildingBank aria-hidden='true' size={20} />
						</div>
						<div>
							<Card.Title>Provisioned agencies</Card.Title>
							<Card.Description>Commercial references are operational identifiers only and must never contain credentials.</Card.Description>
						</div>
					</Card.Header>
					<Card.Content>
						{agencies.length === 0 ? (
							<div className='rounded-2xl bg-surface-secondary p-8 text-center text-sm text-muted'>No agencies provisioned.</div>
						) : (
							<Table variant='secondary'>
								<Table.ScrollContainer>
									<Table.Content aria-label='Provisioned agencies' className='min-w-[720px]'>
										<Table.Header>
											<Table.Column isRowHeader>Agency</Table.Column>
											<Table.Column>Status</Table.Column>
											<Table.Column>Creator seats</Table.Column>
											<Table.Column>Commercial reference</Table.Column>
										</Table.Header>
										<Table.Body>
											{agencies.map(({ account, name, slug }) => (
												<Table.Row key={account.organizationId} id={account.organizationId} textValue={name}>
													<Table.Cell>
														<div className='flex items-center gap-3'>
															<div className='flex size-9 items-center justify-center rounded-xl bg-surface-secondary text-accent'>
																<IconUsers aria-hidden='true' size={18} />
															</div>
															<div>
																<p className='font-medium'>{name}</p>
																<p className='text-xs text-muted'>{slug}</p>
															</div>
														</div>
													</Table.Cell>
													<Table.Cell>
														<Chip size='sm' color={account.status === "active" ? "success" : "warning"} variant='soft'>
															{label(account.status)}
														</Chip>
													</Table.Cell>
													<Table.Cell>
														<span className='font-medium tabular-nums'>{account.creatorSeatLimit}</span>
													</Table.Cell>
													<Table.Cell>
														<span className='text-sm text-muted'>{account.commercialReference ?? "Not provided"}</span>
													</Table.Cell>
												</Table.Row>
											))}
										</Table.Body>
									</Table.Content>
								</Table.ScrollContainer>
							</Table>
						)}
					</Card.Content>
				</Card>
			</div>
		</DashboardNavbar>
	);
}
