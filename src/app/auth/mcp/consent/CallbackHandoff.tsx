"use client";
import { useEffect, useState } from "react";
import { Card, Link, Separator, Tabs } from "@heroui/react";
import { CodeBlock } from "@heroui-pro/react/code-block";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { callbackCommand } from "@/server/mcp/consent-permissions";
export function CallbackHandoff({ clientName, callbackUrl, authorized }: { clientName: string; callbackUrl: string; authorized: boolean }) {
	const [seconds, setSeconds] = useState(4);
	let safe = false;
	try {
		const valid = new URL(callbackUrl);
		safe = valid.protocol === "https:" || (valid.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(valid.hostname));
	} catch {
		// An invalid callback must never start the handoff timer.
	}
	useEffect(() => {
		if (!safe) return;
		const timer = setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
		const redirect = setTimeout(() => window.location.assign(callbackUrl), 4000);
		return () => {
			clearInterval(timer);
			clearTimeout(redirect);
		};
	}, [callbackUrl, safe]);
	if (!safe) return <p role='alert'>The callback is unavailable. Restart the connection from your app.</p>;
	return (
		<Card className='p-6 sm:p-8'>
			<Card.Header className='items-center gap-3 py-7 text-center'>
				{authorized ? <IconCircleCheck size={48} className='text-accent' aria-hidden='true' /> : <IconCircleX size={48} className='text-muted' aria-hidden='true' />}
				<h1 className='text-2xl font-semibold'>{authorized ? "Authorization successful" : "Authorization declined"}</h1>
				<Card.Description>
					{seconds > 0 ? (
						`Redirecting you back to ${clientName} in ${seconds}…`
					) : (
						<>
							If you were not redirected automatically,{" "}
							<Link href={callbackUrl} rel='noreferrer'>
								return to {clientName}
							</Link>
							. You can close this window once your app confirms the connection.
						</>
					)}
				</Card.Description>
			</Card.Header>
			<Separator />
			<Card.Content className='gap-4 pt-6'>
				<div>
					<h2 className='font-semibold'>Redirect failed or authenticating from another environment?</h2>
					<p className='mt-1 text-sm text-muted'>Run a command on the machine where your app is waiting, or give the callback URL to your agent. Do not share it publicly.</p>
				</div>
				<Tabs aria-label='Callback recovery' defaultSelectedKey='curl'>
					<Tabs.ListContainer>
						<Tabs.List>
							<Tabs.Tab id='curl'>
								cURL
								<Tabs.Indicator />
							</Tabs.Tab>
							<Tabs.Tab id='wget'>
								wget
								<Tabs.Indicator />
							</Tabs.Tab>
							<Tabs.Tab id='url'>
								Callback URL
								<Tabs.Indicator />
							</Tabs.Tab>
						</Tabs.List>
					</Tabs.ListContainer>
					{(["curl", "wget", "url"] as const).map((tool) => {
						const code = tool === "url" ? callbackUrl : callbackCommand(callbackUrl, tool);
						return (
							<Tabs.Panel key={tool} id={tool}>
								<CodeBlock>
									<CodeBlock.Header>
										<span className='text-sm'>{tool === "url" ? "Copy the full callback URL" : "Run in the client's environment"}</span>
										<CodeBlock.CopyButton code={code} aria-label={`Copy ${tool === "url" ? "callback URL" : tool + " command"}`} />
									</CodeBlock.Header>
									<pre data-sentry-mask className='overflow-x-auto p-4 text-xs'>
										<code>{code}</code>
									</pre>
								</CodeBlock>
							</Tabs.Panel>
						);
					})}
				</Tabs>
			</Card.Content>
		</Card>
	);
}
