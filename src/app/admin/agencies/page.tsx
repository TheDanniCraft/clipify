import { redirect } from "next/navigation";
import { IconBuildingBank, IconCheck, IconFileDescription, IconMail, IconPlus, IconUsers } from "@tabler/icons-react";
import { validateAdminAuth } from "@actions/auth";
import { getAdminAgenciesAction, provisionAgencyFormAction } from "@/app/actions/agency";
import DashboardNavbar from "@components/dashboardNavbar";
import AdminNavigation from "@components/adminNavigation";
import { AlertContent, AlertDescription, AlertRoot, AlertTitle, Button, CardContent, CardDescription, CardHeader, CardRoot, CardTitle, Chip, Input, Label, TableBody, TableCell, TableColumn, TableContent, TableHeader, TableRoot, TableRow, TableScrollContainer, TextField } from "@components/heroui-client";

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
				<AdminNavigation active='agencies' />
				{params.error ? (
					<AlertRoot status='danger'>
						<AlertContent>
							<AlertTitle>Provisioning failed</AlertTitle>
							<AlertDescription>{label(params.error)}</AlertDescription>
						</AlertContent>
					</AlertRoot>
				) : null}
				{params.created ? (
					<AlertRoot status='success'>
						<IconCheck aria-hidden='true' />
						<AlertContent>
							<AlertDescription>Agency account and owner invitation created.</AlertDescription>
						</AlertContent>
					</AlertRoot>
				) : null}

				<AlertRoot status='accent'>
					<IconFileDescription aria-hidden='true' />
					<AlertContent>
						<AlertTitle>Contact-sales provisioning</AlertTitle>
						<AlertDescription>Create an agency only after custom commercial terms are agreed. Creator seats represent sponsored creator Pro allocations; agency staff never consume them.</AlertDescription>
					</AlertContent>
				</AlertRoot>

				<CardRoot>
					<CardHeader className='gap-3'>
						<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
							<IconPlus aria-hidden='true' size={20} />
						</div>
						<div>
							<CardTitle>Provision an agency</CardTitle>
							<CardDescription>Create the organization, contract seat ceiling, and first owner invitation in one operation.</CardDescription>
						</div>
					</CardHeader>
					<CardContent>
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
					</CardContent>
				</CardRoot>

				<div className='grid gap-4 md:grid-cols-3'>
					<CardRoot variant='secondary'>
						<CardHeader>
							<CardDescription>Provisioned agencies</CardDescription>
							<CardTitle className='text-3xl'>{agencies.length}</CardTitle>
						</CardHeader>
					</CardRoot>
					<CardRoot variant='secondary'>
						<CardHeader>
							<CardDescription>Active agencies</CardDescription>
							<CardTitle className='text-3xl'>{agencies.filter(({ account }) => account.status === "active").length}</CardTitle>
						</CardHeader>
					</CardRoot>
					<CardRoot variant='secondary'>
						<CardHeader>
							<CardDescription>Contracted seats</CardDescription>
							<CardTitle className='text-3xl'>{agencies.reduce((total, { account }) => total + account.creatorSeatLimit, 0)}</CardTitle>
						</CardHeader>
					</CardRoot>
				</div>

				<CardRoot>
					<CardHeader className='gap-3'>
						<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
							<IconBuildingBank aria-hidden='true' size={20} />
						</div>
						<div>
							<CardTitle>Provisioned agencies</CardTitle>
							<CardDescription>Commercial references are operational identifiers only and must never contain credentials.</CardDescription>
						</div>
					</CardHeader>
					<CardContent>
						{agencies.length === 0 ? (
							<div className='rounded-2xl bg-surface-secondary p-8 text-center text-sm text-muted'>No agencies provisioned.</div>
						) : (
							<TableRoot variant='secondary'>
								<TableScrollContainer>
									<TableContent aria-label='Provisioned agencies' className='min-w-[720px]'>
										<TableHeader>
											<TableColumn isRowHeader>Agency</TableColumn>
											<TableColumn>Status</TableColumn>
											<TableColumn>Creator seats</TableColumn>
											<TableColumn>Commercial reference</TableColumn>
										</TableHeader>
										<TableBody>
											{agencies.map(({ account, name, slug }) => (
												<TableRow key={account.organizationId} id={account.organizationId} textValue={name}>
													<TableCell>
														<div className='flex items-center gap-3'>
															<div className='flex size-9 items-center justify-center rounded-xl bg-surface-secondary text-accent'>
																<IconUsers aria-hidden='true' size={18} />
															</div>
															<div>
																<p className='font-medium'>{name}</p>
																<p className='text-xs text-muted'>{slug}</p>
															</div>
														</div>
													</TableCell>
													<TableCell>
														<Chip size='sm' color={account.status === "active" ? "success" : "warning"} variant='soft'>
															{label(account.status)}
														</Chip>
													</TableCell>
													<TableCell>
														<span className='font-medium tabular-nums'>{account.creatorSeatLimit}</span>
													</TableCell>
													<TableCell>
														<span className='text-sm text-muted'>{account.commercialReference ?? "Not provided"}</span>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</TableContent>
								</TableScrollContainer>
							</TableRoot>
						)}
					</CardContent>
				</CardRoot>
			</div>
		</DashboardNavbar>
	);
}
