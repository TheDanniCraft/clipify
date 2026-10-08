"use client";
import { useState } from "react";
import { Accordion, Alert, Avatar, Button, Card, Checkbox, Chip, Description, Label, Link, Separator, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconArrowLeft, IconCheck, IconChevronRight, IconPencil, IconPlugConnected, IconPlus, IconShieldCheck, IconTrash } from "@tabler/icons-react";
import { availableGroups, groupLevel, groupScopes, presetScopes, type AccessLevel, type ConsentMode } from "@/server/mcp/consent-permissions";
import { CallbackHandoff } from "./CallbackHandoff";
export type ConsentCreatorChoice = { creatorId: string; agencyOrganizationId: string | null; name: string; avatarUrl?: string | null };
type Selection = { creatorId: string; mode: ConsentMode; scopes: string[] };
type ConsentResult = { error?: string; callbackUrl?: string; authorized?: boolean };
const LEVEL_LABELS = { none: "None", read: "Read", write: "Write" };
export function ConsentForm({ clientName, requestedScopes, creators, oauthQuery, action }: { clientName: string; requestedScopes: string[]; creators: ConsentCreatorChoice[]; oauthQuery: string; action: (data: FormData) => Promise<ConsentResult | void> }) {
	const [step, setStep] = useState<"creator" | "permissions" | "review">("creator");
	const [entries, setEntries] = useState<Selection[]>([]);
	const [draft, setDraft] = useState<Selection>({ creatorId: "", mode: "read", scopes: presetScopes("read", requestedScopes) });
	const [editing, setEditing] = useState<string>();
	const [offline, setOffline] = useState(requestedScopes.includes("offline_access"));
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	const [handoff, setHandoff] = useState<{ callbackUrl: string; authorized: boolean }>();
	const groups = availableGroups(requestedScopes);
	const writable = groups.some((group) => group.write.some((scope) => requestedScopes.includes(scope)));
	const creator = creators.find((item) => item.creatorId === draft.creatorId);
	const begin = (entry?: Selection) => {
		setEditing(entry?.creatorId);
		setDraft(entry ? { ...entry, scopes: [...entry.scopes] } : { creatorId: "", mode: "read", scopes: presetScopes("read", requestedScopes) });
		setError(undefined);
		setStep("creator");
	};
	const save = () => {
		setEntries((current) => [...current.filter((entry) => entry.creatorId !== editing && entry.creatorId !== draft.creatorId), { ...draft, scopes: [...draft.scopes] }]);
		setStep("review");
		setEditing(undefined);
	};
	const changeGroup = (group: (typeof groups)[number], level: AccessLevel) => {
		const affected = [...group.read, ...group.write] as readonly string[];
		let scopes = [...draft.scopes.filter((scope) => !affected.includes(scope)), ...groupScopes(group, level, requestedScopes)];
		// Feedback requires creator access in addition to its explicit write consent.
		if (scopes.includes("feedback:create") && !scopes.includes("creator:read")) scopes = scopes.filter((scope) => scope !== "feedback:create");
		setDraft({ ...draft, mode: "custom", scopes: [...new Set(scopes)] });
	};
	const identity = (choice: ConsentCreatorChoice) => (
		<span className='flex min-w-0 items-center gap-3'>
			<Avatar size='sm'>
				<Avatar.Image src={choice.avatarUrl ?? undefined} alt='' />
				<Avatar.Fallback>{choice.name.slice(0, 2).toUpperCase()}</Avatar.Fallback>
			</Avatar>
			<span className='min-w-0'>
				<span className='block truncate font-medium'>{choice.name}</span>
				{choice.agencyOrganizationId && <span className='block text-xs text-muted'>Agency access</span>}
			</span>
		</span>
	);
	const permissionList = (scopes: string[], custom = false) => (
		<Accordion allowsMultipleExpanded>
			{groups.map((group) => (
				<Accordion.Item key={group.id} id={group.id}>
					<div className='flex flex-wrap items-center justify-between gap-3'>
						<Accordion.Heading className='min-w-0 flex-1'>
							<Accordion.Trigger className='justify-start gap-2 px-0 py-4 text-sm'>
								<Accordion.Indicator className='ms-0' />
								<span>{group.title}</span>
							</Accordion.Trigger>
						</Accordion.Heading>
						{custom ? (
							<ToggleButtonGroup aria-label={`${group.title} access`} selectionMode='single' disallowEmptySelection selectedKeys={new Set([groupLevel(group, scopes)])} onSelectionChange={(keys) => changeGroup(group, [...keys][0] as AccessLevel)} size='sm'>
								{(["none", "read", "write"] as const).map((level) => (
									<ToggleButton key={level} id={level} isDisabled={(level !== "none" && !(level === "read" ? group.read : group.write).some((scope) => requestedScopes.includes(scope))) || (level === "write" && group.id === "feedback" && !scopes.includes("creator:read"))}>
										{LEVEL_LABELS[level]}
									</ToggleButton>
								))}
							</ToggleButtonGroup>
						) : (
							<Chip size='sm' variant='soft'>
								{LEVEL_LABELS[groupLevel(group, scopes)]}
							</Chip>
						)}
					</div>
					<Accordion.Panel>
						<Accordion.Body className='pb-4 text-sm text-muted'>
							<p>{group.description}</p>
							{custom && <p className='mt-2'>Unavailable levels were not requested by this app or are not supported.{group.id === "feedback" && " Requires Creator information: Read."}</p>}
						</Accordion.Body>
					</Accordion.Panel>
				</Accordion.Item>
			))}
		</Accordion>
	);
	return (
		<main className='min-h-screen bg-background px-4 py-8 sm:py-12'>
			<div className='mx-auto flex w-full max-w-2xl flex-col gap-6'>
				<header className='flex items-center gap-3 text-accent'>
					<span className='flex size-10 items-center justify-center rounded-xl bg-accent-soft'>
						<IconPlugConnected size={22} aria-hidden='true' />
					</span>
					<span className='font-semibold'>Clipify · App connection</span>
				</header>
				{handoff ? (
					<CallbackHandoff clientName={clientName} {...handoff} />
				) : (
					<Card className='p-0'>
						<Card.Header className='gap-3 p-6 sm:p-8'>
							<nav aria-label='Connection steps' className='flex flex-wrap gap-3 text-xs text-muted'>
								{(["creator", "permissions", "review"] as const).map((item, index) => (
									<span key={item} aria-current={step === item ? "step" : undefined} className={step === item ? "font-semibold text-accent" : ""}>
										{index + 1}. {item === "creator" ? "Creator" : item === "permissions" ? "Permissions" : "Review"}
									</span>
								))}
							</nav>
							<h1 className='text-2xl font-semibold tracking-tight'>{step === "creator" ? `Connect ${clientName}` : step === "permissions" ? "Set permissions" : "Review and authorize"}</h1>
							<Card.Description>{step === "creator" ? "Choose a creator to connect to this app." : step === "permissions" ? `Choose the access ${clientName} can have to ${creator?.name ?? "this creator"}. Your roles and plan limits still apply.` : "Review each creator and their permissions before authorizing this connection."}</Card.Description>
						</Card.Header>
						<form
							action={async (data) => {
								setPending(true);
								setError(undefined);
								try {
									const result = await action(data);
									if (result?.error) setError(result.error);
									else if (result?.callbackUrl) setHandoff({ callbackUrl: result.callbackUrl, authorized: result.authorized ?? data.get("accept") === "true" });
								} catch {
									setError("Clipify could not complete this connection. Try again.");
								} finally {
									setPending(false);
								}
							}}
						>
							<input type='hidden' name='oauthQuery' value={oauthQuery} />
							{entries.map((entry) => {
								const choice = creators.find((item) => item.creatorId === entry.creatorId)!;
								return <input key={entry.creatorId} type='hidden' name='creators' value={JSON.stringify({ creatorId: entry.creatorId, agencyOrganizationId: choice.agencyOrganizationId, scopes: entry.scopes })} />;
							})}
							{[...new Set([...entries.flatMap((entry) => entry.scopes), ...(offline ? ["offline_access"] : [])])].map((scope) => (
								<input key={scope} type='hidden' name='scopes' value={scope} />
							))}
							<Card.Content className='flex flex-col gap-5 px-6 pb-6 sm:px-8'>
								{step === "creator" && (
									<>
										{!creators.length && (
											<Alert status='warning'>
												<Alert.Indicator />
												<Alert.Content>
													<Alert.Title>No accessible creators</Alert.Title>
													<Alert.Description>Ask a creator owner for access before connecting this app.</Alert.Description>
												</Alert.Content>
											</Alert>
										)}
										<div aria-label='Choose a creator' className='flex flex-col gap-3'>
											{creators.map((choice) => {
												const added = entries.some((entry) => entry.creatorId === choice.creatorId) && choice.creatorId !== editing;
												return (
													<Button
														key={choice.creatorId}
														type='button'
														variant='secondary'
														aria-label={choice.name}
														isDisabled={added}
														className='h-auto w-full justify-between rounded-xl border border-border bg-transparent px-4 py-4 text-start'
														onPress={() => {
															setDraft({ ...draft, creatorId: choice.creatorId });
															setStep("permissions");
														}}
													>
														{identity(choice)}
														{added ? <span className='text-xs text-muted'>Already added — edit from Review</span> : <IconChevronRight size={18} className='shrink-0 text-muted' aria-hidden='true' />}
													</Button>
												);
											})}
										</div>
									</>
								)}
								{step === "permissions" && (
									<>
										{creator && <div className='rounded-xl bg-surface-secondary p-3'>{identity(creator)}</div>}
										<ToggleButtonGroup
											aria-label='General permissions'
											selectionMode='single'
											disallowEmptySelection
											selectedKeys={new Set([draft.mode])}
											onSelectionChange={(keys) => {
												const mode = [...keys][0] as ConsentMode;
												setDraft({ ...draft, mode, scopes: mode === "custom" ? draft.scopes : presetScopes(mode, requestedScopes) });
											}}
											fullWidth
										>
											<ToggleButton id='read'>Read</ToggleButton>
											<ToggleButton id='write' isDisabled={!writable}>
												Write
											</ToggleButton>
											<ToggleButton id='custom'>Custom</ToggleButton>
										</ToggleButtonGroup>
										<p className='text-sm text-muted'>{!writable ? "This app requested read-only access." : draft.mode === "read" ? "View information without changing it." : draft.mode === "write" ? "Allow requested changes, including deletion where requested. Read-only areas remain Read." : "Choose access for each area. Expand a row to see what it allows."}</p>
										{permissionList(draft.scopes, draft.mode === "custom")}
									</>
								)}
								{step === "review" && (
									<>
										{!entries.length && <p className='text-sm text-muted'>Add a creator before authorizing this connection.</p>}
										{entries.map((entry) => {
											const choice = creators.find((item) => item.creatorId === entry.creatorId)!;
											return (
												<div key={entry.creatorId} className='rounded-xl border border-border p-4'>
													<div className='flex flex-wrap items-center justify-between gap-3'>
														{identity(choice)}
														<div className='flex items-center gap-2'>
															<Chip size='sm' variant='soft'>
																{entry.mode === "custom" ? "Custom" : LEVEL_LABELS[entry.mode]}
															</Chip>
															<Button type='button' variant='tertiary' size='sm' isIconOnly aria-label={`Edit ${choice.name}`} onPress={() => begin(entry)}>
																<IconPencil size={17} />
															</Button>
															<Button type='button' variant='tertiary' size='sm' isIconOnly aria-label={`Remove ${choice.name} from connection`} onPress={() => setEntries((current) => current.filter((item) => item.creatorId !== entry.creatorId))}>
																<IconTrash size={17} />
															</Button>
														</div>
													</div>
													<Accordion>
														<Accordion.Item>
															<Accordion.Heading>
																<Accordion.Trigger className='text-sm'>
																	View permissions
																	<Accordion.Indicator />
																</Accordion.Trigger>
															</Accordion.Heading>
															<Accordion.Panel>
																<Accordion.Body>{permissionList(entry.scopes)}</Accordion.Body>
															</Accordion.Panel>
														</Accordion.Item>
													</Accordion>
												</div>
											);
										})}
										{requestedScopes.includes("offline_access") && (
											<Checkbox isSelected={offline} onChange={setOffline}>
												<Checkbox.Content className='items-start'>
													<Checkbox.Control className='mt-0.5 shrink-0'>
														<Checkbox.Indicator />
													</Checkbox.Control>
													<Label>Stay connected between sessions</Label>
												</Checkbox.Content>
												<Description>Allow refresh until access expires or you revoke this connection.</Description>
											</Checkbox>
										)}
										<p className='flex items-start gap-2 text-sm text-muted'>
											<IconShieldCheck size={18} className='shrink-0' aria-hidden='true' />
											You can revoke this connection in Settings → Connected apps.
										</p>
									</>
								)}
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
							<Separator />
							<Card.Footer className='flex flex-wrap justify-between gap-3 px-6 py-5 sm:px-8'>
								<div className='flex flex-wrap gap-2'>
									{step !== "review" && (step !== "creator" || entries.length > 0) && (
										<Button type='button' variant='tertiary' onPress={() => setStep(step === "permissions" ? "creator" : "review")}>
											<IconArrowLeft size={16} />
											Back
										</Button>
									)}
								</div>

								{step === "permissions" && (
									<Button type='button' isDisabled={!draft.scopes.length} onPress={save}>
										Review
										<IconCheck size={16} />
									</Button>
								)}
								{step === "review" && (
									<div className='flex flex-wrap gap-3'>
										<Button type='button' variant='secondary' onPress={() => begin()}>
											<IconPlus size={16} />
											Add another creator
										</Button>
										<Button type='submit' name='accept' value='true' isPending={pending} isDisabled={pending || !entries.length || entries.some((entry) => !entry.scopes.length)}>
											Authorize
										</Button>
									</div>
								)}
							</Card.Footer>
							<div className='flex justify-center pb-5'>
								<Button type='submit' name='accept' value='false' formNoValidate variant='tertiary' size='sm' isDisabled={pending} className='h-auto bg-transparent text-xs text-muted'>
									Cancel connection
								</Button>
							</div>
						</form>
					</Card>
				)}
				<footer className='flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted'>
					<Link href='/legal/privacy' className='text-xs'>
						Privacy
					</Link>
					<Link href='/legal/terms' className='text-xs'>
						Terms
					</Link>
					<Link href='https://docs.clipify.us' className='text-xs' target='_blank' rel='noreferrer'>
						Help
					</Link>
				</footer>
			</div>
		</main>
	);
}
