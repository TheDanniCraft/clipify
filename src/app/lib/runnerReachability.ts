import { randomBytes } from "crypto";
import * as net from "net";

const RTMP_REACHABILITY_PORT = 1935;
const CHECK_TTL_MS = 60_000;
const PROBE_TIMEOUT_MS = 2_500;
const MAX_IPS_PER_CHECK = 8;
const PROBE_PREFIX = "CLIPIFY_RTMP_PROBE ";

type ReachabilityCheck = {
	runnerId: string;
	nonce: string;
	ips: string[];
	expiresAt: number;
};

const globalReachabilityState = globalThis as typeof globalThis & {
	clipifyRunnerReachabilityChecks?: Map<string, ReachabilityCheck>;
};

const reachabilityChecks = globalReachabilityState.clipifyRunnerReachabilityChecks ?? new Map<string, ReachabilityCheck>();
globalReachabilityState.clipifyRunnerReachabilityChecks = reachabilityChecks;

function normalizeIpCandidate(value: unknown) {
	if (typeof value !== "string") return null;
	let address = value.trim();
	if (!address) return null;

	if (address.startsWith("[")) {
		const closingBracket = address.indexOf("]");
		if (closingBracket === -1) return null;
		address = address.slice(1, closingBracket);
	} else if ((address.match(/:/g) ?? []).length === 1 && address.includes(".")) {
		address = address.split(":")[0];
	}

	address = address.split("%")[0].toLowerCase();
	if (address.startsWith("::ffff:")) address = address.slice("::ffff:".length);

	return net.isIP(address) ? address : null;
}

export function isPublicRoutableAddress(value: unknown) {
	const address = normalizeIpCandidate(value);
	if (!address) return false;

	const ipv4 = address.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (ipv4) {
		const [a, b, c] = ipv4.slice(1).map(Number);
		return !(a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 192 && b === 0 && c === 2) || (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) || a >= 224);
	}

	return !(address === "::1" || address === "::" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("ff") || address.startsWith("2001:db8:"));
}

export function createRunnerReachabilityCheck(runnerId: string, candidates: unknown[]) {
	const ips = [...new Set(candidates.map(normalizeIpCandidate).filter((address): address is string => Boolean(address) && isPublicRoutableAddress(address)))].slice(0, MAX_IPS_PER_CHECK);
	const checkId = randomBytes(16).toString("base64url");
	const nonce = randomBytes(24).toString("base64url");
	reachabilityChecks.set(checkId, {
		runnerId,
		nonce,
		ips,
		expiresAt: Date.now() + CHECK_TTL_MS,
	});
	return { checkId, nonce, ipsToCheck: ips };
}

export function takeRunnerReachabilityCheck(checkId: unknown, runnerId: string) {
	if (typeof checkId !== "string") return null;
	const check = reachabilityChecks.get(checkId);
	reachabilityChecks.delete(checkId);
	if (!check || check.runnerId !== runnerId || check.expiresAt < Date.now()) return null;
	return check;
}

export async function probeRtmpReachability(ip: string, nonce: string) {
	return await new Promise<boolean>((resolve) => {
		const socket = net.createConnection({ host: ip, port: RTMP_REACHABILITY_PORT });
		let response = "";
		let settled = false;
		const finish = (reachable: boolean) => {
			if (settled) return;
			settled = true;
			socket.destroy();
			resolve(reachable);
		};

		socket.setTimeout(PROBE_TIMEOUT_MS);
		socket.on("connect", () => {
			socket.write(`${PROBE_PREFIX}${nonce}\n`);
		});
		socket.on("data", (chunk) => {
			response += chunk.toString("utf8");
			if (response.includes("\n")) finish(response.trim() === "OK");
		});
		socket.on("timeout", () => finish(false));
		socket.on("error", () => finish(false));
		socket.on("close", () => finish(response.trim() === "OK"));
	});
}
