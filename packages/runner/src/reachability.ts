export type RtmpReachabilityStatus = "reachable" | "not_reachable" | "skipped" | "unknown";

export function getRtmpReachabilityConfirmation(status: RtmpReachabilityStatus): string | null {
	if (status === "not_reachable") return "[Security] No publicly reachable RTMP port detected.";
	if (status === "skipped") return "[Security] No public network address detected; RTMP exposure check skipped.";
	return null;
}
