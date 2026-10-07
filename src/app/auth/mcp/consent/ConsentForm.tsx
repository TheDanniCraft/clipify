"use client";
import { useState } from "react";
import { Alert, Button, Card, Checkbox, Chip, Description, Separator } from "@heroui/react";
import { RadioButtonGroup } from "@heroui-pro/react";
import { IconPlugConnected, IconShieldCheck } from "@tabler/icons-react";
import { consentPreset } from "@/server/mcp/scopes";

export type ConsentCreatorChoice = { creatorId: string; agencyOrganizationId: string | null; name: string };
const LABELS: Record<string, string> = {
	"creator:read": "Read creator details and capabilities",
	"overlay:read": "Read overlays",
	"overlay:create": "Create overlays",
	"overlay:update": "Edit overlays",
	"overlay:delete": "Delete overlays",
	"playlist:read": "Read playlists",
	"playlist:create": "Create playlists",
	"playlist:update": "Edit playlists",
	"playlist:delete": "Delete playlists",
	"playlist-items:manage": "Manage playlist items",
	"gallery:read": "Read galleries",
	"gallery:create": "Create galleries",
	"gallery:update": "Edit galleries",
	"gallery:delete": "Delete galleries",
	"gallery:publish": "Publish or unpublish galleries",
	"creator:update": "Edit and publish Creator Pages",
	"runner:read": "Read runners and stream sessions",
	"runner:create": "Create runners and stream sessions (Runner access)",
	"runner:update": "Edit runners and stream configuration",
	"runner:delete": "Delete runners",
	"runner:control": "Start or stop streams (Runner access)",
	"runner-credential:rotate": "Disconnect enrolled runner devices",
	"overlay:control": "Control live overlays (Pro)",
	"overlay-secret:read": "Read private OBS overlay URLs",
	offline_access: "Stay connected until access expires or is revoked",
};
export function ConsentForm({ clientName, requestedScopes, creators, oauthQuery, action }: { clientName: string; requestedScopes: string[]; creators: ConsentCreatorChoice[]; oauthQuery: string; action: (data: FormData) => Promise<{ error?: string } | void> }) {
	const [preset, setPreset] = useState<"read" | "edit">("read");
	const [selected, setSelected] = useState(() => new Set([...consentPreset("read"), "offline_access"].filter((scope) => requestedScopes.includes(scope))));
	const [creatorIds, setCreatorIds] = useState(new Set<string>());
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	const selectPreset = (value: "read" | "edit") => {
		setPreset(value);
		setSelected(new Set([...consentPreset(value), "offline_access"].filter((scope) => requestedScopes.includes(scope))));
	};
	const toggle = (values: Set<string>, value: string, setter: (values: Set<string>) => void) => {
		const next = new Set(values);
		if (next.has(value)) next.delete(value);
		else next.add(value);
		setter(next);
	};
	return (
		<main className='min-h-screen bg-background px-4 py-10 sm:py-16'>
			<div className='mx-auto flex max-w-2xl flex-col gap-6'>
				<div className='flex items-center gap-3 text-accent'>
					<span className='flex size-11 items-center justify-center rounded-2xl bg-accent-soft'>
						<IconPlugConnected size={24} aria-hidden='true' />
					</span>
					<span className='font-semibold'>Clipify · App connection</span>
				</div>
				<Card className='p-0'>
					<Card.Header className='gap-2 p-6 sm:p-8'>
						<Chip size='sm' variant='soft' color='accent'>
							You control access
						</Chip>
						<h1 className='text-2xl font-semibold tracking-tight'>Connect {clientName}</h1>
						<Card.Description>Choose the creators and permissions this app can use. Your current roles and plan limits continue to apply.</Card.Description>
					</Card.Header>
					<form
						action={async (data) => {
							setPending(true);
							setError(undefined);
							try {
								const result = await action(data);
								if (result?.error) setError(result.error);
							} catch {
								setError("Clipify could not complete this connection. Try again.");
							} finally {
								setPending(false);
							}
						}}
					>
						<Card.Content className='flex flex-col gap-7 px-6 pb-6 sm:px-8'>
							<input type='hidden' name='oauthQuery' value={oauthQuery} />
							<fieldset className='flex flex-col gap-3'>
								<legend className='mb-3 text-sm font-semibold'>Creators</legend>
								{!creators.length && (
									<Alert status='warning'>
										<Alert.Indicator />
										<Alert.Content>
											<Alert.Title>No accessible creators</Alert.Title>
											<Alert.Description>Ask a creator owner for access before connecting this app.</Alert.Description>
										</Alert.Content>
									</Alert>
								)}
								{creators.map((creator) => (
									<Checkbox key={creator.creatorId} name='creators' value={JSON.stringify({ creatorId: creator.creatorId, agencyOrganizationId: creator.agencyOrganizationId })} isSelected={creatorIds.has(creator.creatorId)} onChange={() => toggle(creatorIds, creator.creatorId, setCreatorIds)} className='rounded-xl border border-border p-3' variant='secondary'>
										<Checkbox.Content>
											<Checkbox.Control>
												<Checkbox.Indicator />
											</Checkbox.Control>
											{creator.name}
										</Checkbox.Content>
									</Checkbox>
								))}
							</fieldset>
							<Separator />
							<RadioButtonGroup name='preset' value={preset} onChange={(value) => selectPreset(value as "read" | "edit")} className='gap-3' aria-label='What should this app do?'>
								<p className='text-sm font-semibold'>What should this app do?</p>
								<div className='grid gap-3 sm:grid-cols-2'>
									<RadioButtonGroup.Item aria-label='Read' value='read' className='min-w-0 p-4'>
										<RadioButtonGroup.ItemContent>
											<RadioButtonGroup.Indicator />
											Read
										</RadioButtonGroup.ItemContent>
										<Description>View creator details, overlays and playlists.</Description>
									</RadioButtonGroup.Item>
									<RadioButtonGroup.Item aria-label='Read & edit' value='edit' className='min-w-0 p-4'>
										<RadioButtonGroup.ItemContent>
											<RadioButtonGroup.Indicator />
											Read &amp; edit
										</RadioButtonGroup.ItemContent>
										<Description>Create and edit content. Deletion stays off.</Description>
									</RadioButtonGroup.Item>
								</div>
							</RadioButtonGroup>
							<fieldset className='flex flex-col gap-3'>
								<legend className='mb-1 text-sm font-semibold'>Individual permissions</legend>
								<p className='text-sm text-muted'>Adjust the preset to give this app only the access it needs.</p>
								{requestedScopes
									.filter((scope) => LABELS[scope] && !scope.endsWith(":delete"))
									.map((scope) => (
										<Checkbox key={scope} name='scopes' value={scope} isSelected={selected.has(scope)} onChange={() => toggle(selected, scope, setSelected)} variant='secondary'>
											<Checkbox.Content>
												<Checkbox.Control>
													<Checkbox.Indicator />
												</Checkbox.Control>
												{LABELS[scope]}
											</Checkbox.Content>
										</Checkbox>
									))}
							</fieldset>
							{requestedScopes.some((scope) => scope.endsWith(":delete")) && (
								<fieldset className='flex flex-col gap-3 rounded-xl bg-danger-soft p-4'>
									<legend className='sr-only'>Deletion permissions</legend>
									<p className='text-sm font-semibold text-danger-soft-foreground'>Allow deletion separately</p>
									<p className='text-sm text-muted'>These permissions let the app permanently delete content.</p>
									{requestedScopes
										.filter((scope) => scope.endsWith(":delete") && LABELS[scope])
										.map((scope) => (
											<Checkbox key={scope} name='scopes' value={scope} isSelected={selected.has(scope)} onChange={() => toggle(selected, scope, setSelected)} variant='secondary'>
												<Checkbox.Content>
													<Checkbox.Control>
														<Checkbox.Indicator />
													</Checkbox.Control>
													{LABELS[scope]}
												</Checkbox.Content>
											</Checkbox>
										))}
								</fieldset>
							)}
							<p className='flex items-start gap-2 text-sm text-muted'>
								<IconShieldCheck size={18} className='mt-0.5 shrink-0' aria-hidden='true' />
								You can revoke this connection anytime in account settings.
							</p>
							{error && (
								<Alert status='danger' role='alert'>
									<Alert.Indicator />
									<Alert.Content>
										<Alert.Title>Connection could not be approved</Alert.Title>
										<Alert.Description>{error}</Alert.Description>
									</Alert.Content>
								</Alert>
							)}
						</Card.Content>
						<Card.Footer className='flex flex-col-reverse gap-3 border-t border-border px-6 py-5 sm:flex-row sm:justify-end sm:px-8'>
							<Button type='submit' name='accept' value='false' formNoValidate isDisabled={pending} variant='tertiary'>
								Deny
							</Button>
							<Button type='submit' name='accept' value='true' isPending={pending} isDisabled={pending || !creatorIds.size || !selected.size} variant='primary'>
								Approve connection
							</Button>
						</Card.Footer>
					</form>
				</Card>
			</div>
		</main>
	);
}
