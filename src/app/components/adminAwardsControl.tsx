"use client";
import { useState, useTransition } from "react";
import { Button, Modal, TextField, TextArea, Input, Label, Select, ListBox, Checkbox } from "@heroui/react";
import { grantAdminAwards, getAdminUserAwards, revokeAdminAward, type AdminAwardInput } from "@/app/actions/admin-benefits";
import { badgeCatalog } from "@lib/badgeCatalog";

type Recipient = { id: string; username: string };
function Choice({ label, value, options, onChange }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (value: string) => void }) {
	return (
		<Select value={value} onChange={(value) => onChange(String(value))}>
			<Label>{label}</Label>
			<Select.Trigger>
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					{options.map((item) => (
						<ListBox.Item key={item.id} id={item.id} textValue={item.label}>
							{item.label}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}
export default function AdminAwardsControl({ recipients, onChanged, label = "Manage benefits" }: { recipients: Recipient[]; onChanged: () => Promise<void>; label?: string }) {
	const [open, setOpen] = useState(false),
		[kind, setKind] = useState<AdminAwardInput["kind"]>("pro_access"),
		[days, setDays] = useState("7"),
		[unlimited, setUnlimited] = useState(false),
		[badge, setBadge] = useState("contributor"),
		[reason, setReason] = useState(""),
		[review, setReview] = useState(false),
		[removal, setRemoval] = useState<{ grantId?: string; badge?: string } | null>(null),
		[operationId, setOperationId] = useState(""),
		[message, setMessage] = useState(""),
		[pending, startTransition] = useTransition(),
		[awards, setAwards] = useState<Awaited<ReturnType<typeof getAdminUserAwards>> | null>(null);
	const badgeOptions = Object.entries(badgeCatalog)
		.filter(([, definition]) => !("condition" in definition))
		.map(([id, definition]) => ({ id, label: definition.name }));
	function loadAwards() {
		if (recipients.length === 1)
			startTransition(async () => {
				try {
					setAwards(await getAdminUserAwards(recipients[0].id));
				} catch {
					setMessage("Could not load existing benefits.");
				}
			});
	}
	function submit() {
		startTransition(async () => {
			try {
				const result = await grantAdminAwards({ userIds: recipients.map((r) => r.id), operationId, kind, days: unlimited ? null : Number(days), badge: kind === "badge" ? badge : undefined, reason });
				const failed = result.results.filter((r) => r.status === "failed");
				setMessage(`${result.results.filter((r) => r.status === "granted").length} granted; ${result.results.filter((r) => r.status === "unchanged").length} already granted; ${failed.length} failed.${failed.length ? " Retry to process failed recipients; successful grants will not be duplicated." : " Notification emails are queued."}`);
				await onChanged();
				if (recipients.length === 1) setAwards(await getAdminUserAwards(recipients[0].id));
			} catch {
				setMessage("Could not grant these benefits. Check your selection and try again.");
			}
		});
	}
	function revoke(input: { grantId?: string; badge?: string }) {
		startTransition(async () => {
			try {
				await revokeAdminAward({ userId: recipients[0].id, ...input });
				setAwards(await getAdminUserAwards(recipients[0].id));
				await onChanged();
				setRemoval(null);
				setMessage("Benefit removed and notification queued.");
			} catch {
				setMessage("Could not remove this benefit.");
			}
		});
	}
	return (
		<>
			<Button
				size='sm'
				variant='tertiary'
				isDisabled={!recipients.length}
				onPress={() => {
					setOpen(true);
					setReview(false);
					setRemoval(null);
					setMessage("");
					setOperationId(crypto.randomUUID());
					setAwards(null);
					loadAwards();
				}}
			>
				{label}
			</Button>
			{open && (
				<Modal.Backdrop
					isOpen={open}
					onOpenChange={(value) => {
						if (!pending) setOpen(value);
					}}
				>
					<Modal.Container>
						<Modal.Dialog>
							<Modal.CloseTrigger isDisabled={pending} />
							<Modal.Header>
								<Modal.Heading>{review ? "Review awards" : "Grant access or badges"}</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<p>
									{recipients.length} {recipients.length === 1 ? "recipient" : "recipients"}: {recipients.map((r) => `@${r.username}`).join(", ")}
								</p>
								{review ? (
									<div className='space-y-2 rounded-xl bg-surface-secondary p-4'>
										<p className='font-semibold'>{kind === "badge" ? badgeCatalog[badge as keyof typeof badgeCatalog]?.name : kind === "runner_access" ? "Runner access" : "Clipify Pro"}</p>
										{kind !== "badge" && <p>{unlimited ? "No expiry" : `${days} days`}</p>}
										<p>
											{kind === "badge" ? "Audit reason" : "Customer-facing reason"}: {reason}
										</p>
										<p>Each newly granted benefit sends one notification. Existing badges and successful retries are skipped.</p>
									</div>
								) : (
									<>
										<Choice
											label='Benefit'
											value={kind}
											onChange={(value) => setKind(value as AdminAwardInput["kind"])}
											options={[
												{ id: "pro_access", label: "Clipify Pro" },
												{ id: "runner_access", label: "Runner access" },
												{ id: "badge", label: "Badge" },
											]}
										/>
										{kind === "badge" ? (
											<Choice label='Badge' value={badge} onChange={setBadge} options={badgeOptions} />
										) : (
											<>
												<TextField>
													<Label>Duration in days</Label>
													<Input aria-label='Duration in days' type='number' min={1} max={3650} value={days} disabled={unlimited} onChange={(event) => setDays(event.target.value)} />
												</TextField>
												<Checkbox isSelected={unlimited} onChange={setUnlimited}>
													<Checkbox.Control>
														<Checkbox.Indicator />
													</Checkbox.Control>
													<Checkbox.Content>No expiry</Checkbox.Content>
												</Checkbox>
											</>
										)}
										<TextField>
											<Label>{kind === "badge" ? "Audit reason" : "Customer-facing reason"}</Label>
											<TextArea aria-label='Customer-facing reason' maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
										</TextField>
										<p className='text-sm text-muted'>Entitlement recipients see this reason in their email. Automatic badges such as Partner are managed by their eligibility rules.</p>
									</>
								)}
								{message && <p role='status'>{message}</p>}
								{removal && (
									<section className='rounded-xl bg-danger-soft p-4 space-y-2' aria-label='Confirm removal'>
										<p>
											Remove this {removal.badge ? "badge" : "access"} from @{recipients[0].username}? A notification will be queued. Other access remains active. Ending a partnership includes a seven-day Pro transition.
										</p>
										<Button variant='tertiary' isDisabled={pending} onPress={() => setRemoval(null)}>
											Keep benefit
										</Button>
										<Button variant='danger' isPending={pending} onPress={() => revoke(removal)}>
											Confirm removal
										</Button>
									</section>
								)}
								{!review && awards && (
									<section className='space-y-2'>
										<h3 className='font-semibold'>Existing benefits</h3>
										{awards.grants.map((grant) => (
											<div key={grant.id} className='flex items-center justify-between gap-2'>
												<span>
													{grant.source === "partner" && grant.entitlement === "pro_access" ? "Partnership" : grant.entitlement === "runner_access" ? "Runner access" : "Clipify Pro"} · {grant.endsAt ? new Date(grant.endsAt).toLocaleDateString("en-US") : "No expiry"}
												</span>
												<Button size='sm' variant='danger-soft' isPending={pending} isDisabled={grant.partnershipEnded} onPress={() => setRemoval({ grantId: grant.id })}>
													{grant.partnershipEnded ? "Partnership ended" : grant.source === "partner" && grant.entitlement === "pro_access" ? "End partnership" : "Remove access"}
												</Button>
											</div>
										))}
										{awards.badges
											.filter((award) => !("condition" in badgeCatalog[award.badge]))
											.map((award) => (
												<div key={award.badge} className='flex items-center justify-between'>
													<span>{badgeCatalog[award.badge].name}</span>
													<Button size='sm' variant='danger-soft' isPending={pending} onPress={() => setRemoval({ badge: award.badge })}>
														Remove badge
													</Button>
												</div>
											))}
									</section>
								)}
							</Modal.Body>
							<Modal.Footer>
								<Button variant='tertiary' isDisabled={pending} onPress={() => (review ? setReview(false) : setOpen(false))}>
									{review ? "Back" : "Close"}
								</Button>
								{review ? (
									<Button isPending={pending} onPress={submit}>
										Confirm awards
									</Button>
								) : (
									<Button isDisabled={!reason.trim() || (kind !== "badge" && !unlimited && (!Number.isInteger(Number(days)) || Number(days) < 1 || Number(days) > 3650))} onPress={() => setReview(true)}>
										Review
									</Button>
								)}
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			)}
		</>
	);
}
