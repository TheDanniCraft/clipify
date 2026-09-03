import type { MemberProfile } from "@lib/membership";
import { formatMemberNumber, formatMemberSince } from "@lib/membershipFormat";
import { ImageResponse } from "next/og";
import Logo from "@components/logo";
import { memberAvatarUrl } from "@lib/memberCardLinks";

async function loadAvatar(value: string): Promise<string | null> {
	const url = memberAvatarUrl(value);
	if (!url) return null;
	try {
		const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(2500) });
		const type = response.headers.get("Content-Type")?.split(";")[0];
		if (!response.ok || (type !== "image/png" && type !== "image/jpeg")) return null;
		if (Number(response.headers.get("Content-Length")) > 2_000_000) return null;
		const bytes = await response.arrayBuffer();
		if (bytes.byteLength > 2_000_000) return null;
		return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
	} catch {
		return null;
	}
}

export async function createMemberCardImage(profile: MemberProfile, download = false) {
	const featuredBadge = profile.badges[0]?.name ?? "Clipify Member";
	const avatar = await loadAvatar(profile.avatar);
	const filenameUsername = profile.username.replace(/[^a-z0-9_-]/gi, "_") || "member";

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "radial-gradient(circle at 25% 10%, #36204e 0%, #100c1b 42%, #08060d 100%)",
				fontFamily: "Arial, sans-serif",
			}}
		>
			<div
				style={{
					position: "relative",
					width: 680,
					height: 980,
					display: "flex",
					flexDirection: "column",
					padding: 64,
					borderRadius: 54,
					border: "2px solid rgba(255,255,255,0.18)",
					background: "radial-gradient(circle at 95% 92%, rgba(141,66,249,0.25), transparent 35%), radial-gradient(circle at 10% 5%, rgba(99,85,160,0.38), transparent 34%), linear-gradient(145deg, #20152e, #100c1b)",
					boxShadow: "0 45px 120px rgba(141,66,249,0.24)",
					color: "white",
				}}
			>
				<svg width={680} height={980} viewBox='0 0 680 980' style={{ position: "absolute", top: 0, left: 0, opacity: 0.08 }}>
					<defs>
						<pattern id='card-marks' width='140' height='140' patternUnits='userSpaceOnUse'>
							<path d='M25 20 60 40 25 60Z M33 28 68 48 33 68Z M112 97v18m-9-9h18' fill='none' stroke='#d8c2ff' strokeWidth='1.2' />
						</pattern>
					</defs>
					<rect width='680' height='980' fill='url(#card-marks)' />
				</svg>
				<div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 700, color: "rgba(255,255,255,0.82)" }}>
					<Logo size={48} />
					Clipify
				</div>

				<div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
					<div style={{ display: "flex", width: 196, height: 196, borderRadius: 98, border: "6px solid #826aad", marginBottom: 38, alignItems: "center", justifyContent: "center", background: "#302045", fontSize: 60 }}>
						{avatar ? (
							// eslint-disable-next-line @next/next/no-img-element -- ImageResponse rasterizes this embedded image.
							<img src={avatar} width={184} height={184} alt='' style={{ borderRadius: 92, objectFit: "cover" }} />
						) : (
							profile.username.slice(0, 2).toUpperCase()
						)}
					</div>
					<div style={{ maxWidth: 550, overflow: "hidden", fontSize: 62, fontWeight: 800, letterSpacing: -2, whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{profile.username}</div>
					<div style={{ marginTop: 20, padding: "12px 24px", borderRadius: 40, border: "1px solid #826aad", background: "#8d42f915", fontSize: 20, fontWeight: 600, letterSpacing: 4, textTransform: "uppercase", color: "#decafa" }}>{featuredBadge}</div>
				</div>

				<div style={{ display: "flex", justifyContent: "space-between", gap: 40 }}>
					<div style={{ display: "flex", flexDirection: "column" }}>
						<div style={{ fontSize: 17, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Joined</div>
						<div style={{ marginTop: 8, fontSize: 27, fontWeight: 700, color: "rgba(255,255,255,0.86)" }}>{formatMemberSince(profile.joinedAt)}</div>
					</div>
					<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
						<div style={{ fontSize: 17, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Member</div>
						<div style={{ marginTop: 8, fontSize: 27, fontWeight: 700, color: "rgba(255,255,255,0.86)" }}>{formatMemberNumber(profile.memberNumber)}</div>
					</div>
				</div>
				<div style={{ display: "flex", justifyContent: "center", marginTop: 40, fontSize: 14, letterSpacing: 4, color: "#bba6d1" }}>YOUR MOMENTS. YOUR COMMUNITY.</div>
			</div>
		</div>,
		{
			width: 1200,
			height: 1200,
			headers: { "Cache-Control": "private, no-store", ...(download ? { "Content-Disposition": `attachment; filename="clipify-member-${filenameUsername}.png"` } : {}) },
		},
	);
}
