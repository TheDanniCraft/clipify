export type RunnerOutput = { id: string; state: "connecting" | "streaming" | "retrying" | "failed" | "stopped" };
const labels: Record<RunnerOutput["state"], string> = { connecting: "Connecting", streaming: "Live", retrying: "Retrying", failed: "Failed", stopped: "Stopped" };

export default function RunnerOutputStatus({ output, online, name }: { output?: RunnerOutput; online: boolean; name: string }) {
	const label = !online ? "Offline" : output ? labels[output.state] : "Awaiting status";
	const color = !online || !output ? "text-muted" : output.state === "streaming" ? "text-success" : output.state === "failed" ? "text-danger" : output.state === "retrying" ? "text-warning" : "text-muted";
	return (
		<span role='status' aria-label={`${name}: ${label}`} className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs ${color}`}>
			<span aria-hidden='true' className='size-1.5 rounded-full bg-current' />
			{label}
		</span>
	);
}
