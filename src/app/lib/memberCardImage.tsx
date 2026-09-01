import type { MemberProfile } from "@lib/membership";
import { formatMemberNumber, formatMemberSince } from "@lib/membershipFormat";
import { ImageResponse } from "next/og";

export function createMemberCardImage(profile: MemberProfile, download = false) {
	const featuredBadge = profile.badges[0]?.name ?? "Clipify Member";

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "radial-gradient(circle at 25% 10%, #252b5c 0%, #080a10 42%, #030405 100%)",
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
					background: "radial-gradient(circle at 95% 92%, rgba(34,211,238,0.25), transparent 35%), radial-gradient(circle at 10% 5%, rgba(99,102,241,0.38), transparent 34%), linear-gradient(145deg, #171923, #0b0d14)",
					boxShadow: "0 45px 120px rgba(34,211,238,0.24)",
					color: "white",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 700, color: "rgba(255,255,255,0.82)" }}>
					<div style={{ width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 15, background: "rgba(255,255,255,0.1)", fontSize: 24 }}>C</div>
					Clipify
				</div>

				<div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
					<div style={{ maxWidth: 550, overflow: "hidden", fontSize: 62, fontWeight: 800, letterSpacing: -2, whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{profile.username}</div>
					<div style={{ marginTop: 10, fontSize: 20, fontWeight: 600, letterSpacing: 5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>{featuredBadge}</div>
				</div>

				<div style={{ display: "flex", justifyContent: "space-between", gap: 40 }}>
					<div style={{ display: "flex", flexDirection: "column" }}>
						<div style={{ fontSize: 17, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Joined</div>
						<div style={{ marginTop: 8, fontSize: 27, fontWeight: 700, color: "rgba(255,255,255,0.86)" }}>{formatMemberSince(profile.joinedAt, profile.memberNumber)}</div>
					</div>
					<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
						<div style={{ fontSize: 17, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Member</div>
						<div style={{ marginTop: 8, fontSize: 27, fontWeight: 700, color: "rgba(255,255,255,0.86)" }}>{formatMemberNumber(profile.memberNumber)}</div>
					</div>
				</div>
			</div>
		</div>,
		{
			width: 1200,
			height: 1200,
			headers: download ? { "Content-Disposition": `attachment; filename="clipify-member-${profile.username}.png"` } : { "Cache-Control": "private, no-store" },
		},
	);
}
