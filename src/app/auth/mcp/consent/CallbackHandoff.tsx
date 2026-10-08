"use client";
import { Accordion, Card, Link, Separator, Tabs } from "@heroui/react";
import { CodeBlock } from "@heroui-pro/react/code-block";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { callbackCommand } from "@/server/mcp/consent-permissions";
import { AuthorizationErrorCard } from "./AuthorizationError";
export function CallbackHandoff({ clientName, callbackUrl, authorized }: { clientName: string; callbackUrl: string; authorized: boolean }) {
	let safe = false;
	try {
		const valid = new URL(callbackUrl);
		safe = valid.protocol === "https:" || (valid.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(valid.hostname));
	} catch {
		// An invalid callback must never expose a navigation link.
	}
	if (!safe) return <AuthorizationErrorCard role='alert' title='Callback unavailable' />;
	return (
		<Card className='p-6 sm:p-8'>
			<Card.Header className='items-center gap-3 py-7 text-center'>
				{authorized ? <IconCircleCheck size={48} className='text-accent' aria-hidden='true' /> : <IconCircleX size={48} className='text-muted' aria-hidden='true' />}
				<h1 className='text-2xl font-semibold'>{authorized ? "Authorization successful" : "Authorization declined"}</h1>
				<Card.Description>{authorized ? "Your access choices have been saved. Continue to your app to finish connecting." : "Return to your app to finish this authorization request."}</Card.Description>
				<Link href={callbackUrl} rel='noreferrer' className='rounded-full bg-accent px-6 py-3 font-medium text-accent-foreground'>
					Continue to {clientName}
				</Link>
			</Card.Header>
			<Separator />
			<Card.Content className='gap-4 pt-6'>
				<Accordion>
					<Accordion.Item id='callback-recovery'>
						<Accordion.Heading>
							<Accordion.Trigger>
								Connecting from another device or remote environment?
								<Accordion.Indicator />
							</Accordion.Trigger>
						</Accordion.Heading>
						<Accordion.Panel>
							<Accordion.Body>
								<p className='mb-4 text-sm text-muted'>Run this command on the machine where your app is waiting, or give the callback URL to your agent. Do not share it publicly. If the redirect fails, return here to copy these instructions.</p>
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
												<CodeBlock className='text-foreground'>
													<CodeBlock.Header>
														<span className='text-sm'>{tool === "url" ? "Copy the full callback URL" : "Run in the client's environment"}</span>
														<CodeBlock.CopyButton code={code} aria-label={`Copy ${tool === "url" ? "callback URL" : tool + " command"}`} />
													</CodeBlock.Header>
													<CodeBlock.Code data-sentry-mask code={code} language='plaintext' className='[&_pre]:text-foreground [&_span]:!text-foreground' />
												</CodeBlock>
											</Tabs.Panel>
										);
									})}
								</Tabs>
							</Accordion.Body>
						</Accordion.Panel>
					</Accordion.Item>
				</Accordion>
			</Card.Content>
		</Card>
	);
}
