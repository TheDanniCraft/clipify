"use client";
import { useState } from "react";
import { Accordion, Button, InputGroup, Label, Link, TextField } from "@heroui/react";
import { IconCheck, IconCopy, IconEye, IconEyeOff } from "@tabler/icons-react";

export default function AdvancedRunnerSetup({ token, error, onRetry, pending = false }: { token: string | null; error: string | null; onRetry: () => void; pending?: boolean }) {
	const [visible, setVisible] = useState(false),
		[copied, setCopied] = useState(false),
		[copyError, setCopyError] = useState<string | null>(null);
	async function copy() {
		if (!token) return;
		try {
			await navigator.clipboard.writeText(token);
			setCopied(true);
			setCopyError(null);
		} catch {
			setCopyError("Clipboard unavailable. Reveal the token and copy it manually.");
		}
	}
	return (
		<Accordion>
			<Accordion.Item id='advanced-runner-setup'>
				<Accordion.Heading>
					<Accordion.Trigger>
						Advanced / Headless setup
						<Accordion.Indicator />
					</Accordion.Trigger>
				</Accordion.Heading>
				<Accordion.Panel>
					<Accordion.Body className='space-y-3'>
						<TextField value={token ?? ""} type={visible ? "text" : "password"} isReadOnly>
							<Label>Manual Runner Token</Label>
							<InputGroup variant='secondary'>
								<InputGroup.Input className='min-w-0 font-mono' />
								<InputGroup.Suffix>
									<Button isIconOnly variant='tertiary' aria-label={visible ? "Hide runner token" : "Reveal runner token"} isDisabled={!token} onPress={() => setVisible(!visible)}>
										{visible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
									</Button>
									<Button isIconOnly variant='tertiary' aria-label='Copy runner token' isDisabled={!token} onPress={copy}>
										{copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
									</Button>
								</InputGroup.Suffix>
							</InputGroup>
						</TextField>
						<p className='text-sm text-muted'>
							For a headless computer, set <code>CLIPIFY_TOKEN</code> to this token when starting Runner.
						</p>
						<Link href='https://help.clipify.us/hc/clipify/articles/self-hosted-clipify-runner' target='_blank' rel='noopener noreferrer'>
							Read the headless setup guide
						</Link>
						{copied && (
							<p role='status' className='text-sm text-success'>
								Token copied
							</p>
						)}
						{(error || copyError) && (
							<p role='alert' className='text-sm text-danger'>
								{error || copyError}
							</p>
						)}
						{!token && (
							<Button variant='secondary' onPress={onRetry} isPending={pending}>
								Retry loading token
							</Button>
						)}
					</Accordion.Body>
				</Accordion.Panel>
			</Accordion.Item>
		</Accordion>
	);
}
