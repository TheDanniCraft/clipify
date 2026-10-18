type Output = { id: string; state: "connecting" | "streaming" | "retrying" | "failed" | "stopped" };
const labels: Record<Output["state"], string> = { connecting: "Connecting", streaming: "Live", retrying: "Retrying", failed: "Failed", stopped: "Stopped" };

export default function RunnerOutputStatus({ outputs = [], destinations, online }: { outputs?: readonly Output[]; destinations: readonly { id: string; name: string }[]; online: boolean }) {
	return (
		<section className='space-y-3' aria-label='Broadcast destination status'>
			<h3 className='text-sm font-medium'>Destination status</h3>
			{!online && <p className='text-sm text-muted'>Runner offline. Showing last reported status.</p>}
			{!outputs.length && <p className='text-sm text-muted'>Waiting for the Runner to report destination status.</p>}
			<ul aria-label='Destination status' aria-live='polite' className='space-y-2'>
				{outputs.map((output) => (
					<li key={output.id} className='flex items-center justify-between gap-4 rounded-lg border border-divider px-3 py-2 text-sm'>
						<span>{destinations.find((destination) => destination.id === output.id)?.name ?? `Destination ${output.id.slice(0, 8)}`}</span>
						<span className={!online ? "text-muted" : output.state === "streaming" ? "text-success" : output.state === "failed" ? "text-danger" : output.state === "retrying" ? "text-warning" : "text-muted"}>{labels[output.state]}</span>
					</li>
				))}
			</ul>
			{online && outputs.some((output) => output.state === "retrying") && outputs.some((output) => output.state === "streaming") && <p className='text-sm text-muted'>Your other destinations keep streaming while this destination reconnects.</p>}
			{online && outputs.some((output) => output.state === "failed") && <p className='text-sm text-muted'>Check the failed destination settings, then stop and start the broadcast to try again.</p>}
		</section>
	);
}
