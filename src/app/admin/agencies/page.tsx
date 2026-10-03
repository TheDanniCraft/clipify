import { redirect } from "next/navigation";
import Link from "next/link";
import { IconBuildingBank, IconCheck, IconPlus, IconUsers } from "@tabler/icons-react";
import { validateAdminAuth } from "@actions/auth";
import { getAdminAgenciesAction } from "@/app/actions/agency";
import DashboardNavbar from "@components/dashboardNavbar";
import AdminNavigation from "@components/adminNavigation";
import { AlertContent, AlertDescription, AlertRoot, AlertTitle, CardContent, CardDescription, CardHeader, CardRoot, CardTitle, Chip, TableBody, TableCell, TableColumn, TableContent, TableHeader, TableRoot, TableRow, TableScrollContainer } from "@components/heroui-client";
import AgencyProvisionForm from "./agency-provision-form";

export const dynamic = "force-dynamic";

function label(value: string) {
	return value
		.split("_")
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

export default async function AdminAgenciesPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string; invitationId?: string; emailSent?: string }> }) {
	const user = await validateAdminAuth(true);
	if (!user) redirect("/dashboard");
	const [agencies, params] = await Promise.all([getAdminAgenciesAction(), searchParams]);
	const invitationHref = params.invitationId ? `/accept-invitation?invitationId=${encodeURIComponent(params.invitationId)}` : null;

	return (
		<DashboardNavbar user={user} title='Agency accounts' tagline='Provision negotiated terms and Stripe-backed creator or Runner seats'>
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
							<AlertDescription>
								<span>Agency account and owner invitation created.</span> {params.emailSent === "1" ? "The invitation email was sent." : "Email delivery failed; share the invitation link manually."}{" "}
								{invitationHref ? (
									<Link href={invitationHref} className='font-medium text-accent underline underline-offset-4'>
										Open invitation
									</Link>
								) : null}
							</AlertDescription>
						</AlertContent>
					</AlertRoot>
				) : null}

				<CardRoot>
					<CardHeader className='gap-3'>
						<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
							<IconPlus aria-hidden='true' size={20} />
						</div>
						<div>
							<CardTitle>Provision an agency</CardTitle>
							<CardDescription>Create the organization and owner invitation after commercial terms and an initial creator-seat quantity are agreed.</CardDescription>
						</div>
					</CardHeader>
					<CardContent>
						<AgencyProvisionForm />
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
