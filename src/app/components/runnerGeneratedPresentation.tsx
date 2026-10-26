"use client";

import LocalizedDate from "@components/localizedDate";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Logo from "./logo";
import { parseRunnerStandbyAppearance, type RunnerStandbyAppearance, type RunnerNextBroadcast } from "@/app/lib/runnerStandby";
import Image from "next/image";
import { resolveRunnerBrandingPlacement, resolveRunnerAttributionStyle, expandRunnerOccupiedRect } from "@/app/lib/runnerBrandingLayout";

const outputSize = (pixels: number) => `calc(100vh * ${pixels} / 1080)`;

/** This wrapper is used only by the authenticated generated Runner surface. */
export default function RunnerGeneratedPresentation({
	attributionRequired: admittedAttributionRequired,
	executionGeneration,
	watermarkCorner = "bottom_right",
	knownPaidUntil: admittedPaidUntil,
	policyUrl,
	runnerPro: admittedRunnerPro = false,
	standbyBackgroundColor = "#000000",
	standbyBackgroundImageUrl,
	standbyLogoUrl,
	standbyMessage = "",
	standbyNextBroadcast,
	children,
}: {
	attributionRequired: boolean;
	executionGeneration: string;
	runnerPro?: boolean;
	standbyBackgroundColor?: string;
	standbyBackgroundImageUrl?: string;
	standbyLogoUrl?: string;
	standbyMessage?: string;
	standbyNextBroadcast?: RunnerNextBroadcast | null;
	knownPaidUntil?: string | null;
	policyUrl?: string;
	watermarkCorner?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
	children: ReactNode;
}) {
	const [refreshedPolicy, setRefreshedPolicy] = useState<{ executionGeneration: string; attributionRequired: boolean; runnerPro?: boolean; validUntil: string | null; standby?: RunnerStandbyAppearance } | null>(null);
	const currentPolicy = refreshedPolicy?.executionGeneration === executionGeneration ? refreshedPolicy : null;
	const knownPaidUntil = currentPolicy ? currentPolicy.validUntil : admittedPaidUntil;
	const readPaidExpiry = useCallback(() => {
		if (knownPaidUntil == null) return false;
		const deadline = Date.parse(knownPaidUntil);
		return !Number.isFinite(deadline) || deadline <= Date.now();
	}, [knownPaidUntil]);
	const subscribePaidExpiry = useCallback(
		(notify: () => void) => {
			let timer: ReturnType<typeof setTimeout> | undefined;
			let cancelled = false;
			const schedule = () => {
				const remaining = Date.parse(knownPaidUntil ?? "") - Date.now();
				if (!cancelled && Number.isFinite(remaining) && remaining > 0)
					timer = setTimeout(
						() => {
							notify();
							schedule();
						},
						Math.min(remaining, 2_147_483_647),
					);
			};
			schedule();
			return () => {
				cancelled = true;
				clearTimeout(timer);
			};
		},
		[knownPaidUntil],
	);
	const paidAppearanceExpired = useSyncExternalStore(subscribePaidExpiry, readPaidExpiry, () => false);
	const attributionRequired = (currentPolicy?.attributionRequired ?? admittedAttributionRequired) || paidAppearanceExpired;
	useEffect(() => {
		if (!policyUrl || !policyUrl.startsWith("/") || policyUrl.startsWith("//")) return;
		const controller = new AbortController();
		let timer: ReturnType<typeof setTimeout> | undefined;
		const refresh = async () => {
			let nextCheck = 5000;
			try {
				const response = await fetch(policyUrl, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
				if (response.ok) {
					const policy: unknown = await response.json();
					if (policy && typeof policy === "object" && "executionGeneration" in policy && policy.executionGeneration === executionGeneration && "attributionRequired" in policy && typeof policy.attributionRequired === "boolean" && "validUntil" in policy && (policy.validUntil === null || (typeof policy.validUntil === "string" && Number.isFinite(Date.parse(policy.validUntil))))) {
						if (controller.signal.aborted) return;
						const standby = "standby" in policy ? parseRunnerStandbyAppearance(policy.standby) : null;
						const attributionRequired = policy.attributionRequired,
							validUntil = policy.validUntil,
							runnerPro = "runnerPro" in policy && typeof policy.runnerPro === "boolean" ? policy.runnerPro : undefined;
						setRefreshedPolicy((previous) => ({ executionGeneration, attributionRequired, runnerPro, validUntil, standby: standby ?? (previous?.executionGeneration === executionGeneration ? previous.standby : undefined) }));
						nextCheck = policy.validUntil === null ? 30000 : Math.min(30000, Math.max(1000, Date.parse(policy.validUntil) - Date.now() - 1000));
					}
				}
			} catch {
				// Retain the last authoritative deadline during a transient network failure.
			}
			if (!controller.signal.aborted) timer = setTimeout(refresh, nextCheck);
		};
		void refresh();
		return () => {
			controller.abort();
			clearTimeout(timer);
		};
	}, [policyUrl, executionGeneration]);

	const rootRef = useRef<HTMLDivElement>(null);
	const badgeRef = useRef<HTMLElement>(null);
	const [standby, setStandby] = useState(false);
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const update = () => {
			const phase = root.querySelector("[data-runner-content-phase]")?.getAttribute("data-runner-content-phase");
			setStandby(phase === "standby" || phase === "empty");
		};
		update();
		const observer = new MutationObserver(update);
		observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-runner-content-phase"] });
		return () => observer.disconnect();
	}, [executionGeneration]);
	const effectiveRunnerPro = (currentPolicy?.runnerPro ?? admittedRunnerPro) && !paidAppearanceExpired;
	const appearanceColor = currentPolicy?.standby?.backgroundColor ?? standbyBackgroundColor;
	const appearanceBackground = currentPolicy?.standby ? currentPolicy.standby.backgroundImageUrl : standbyBackgroundImageUrl;
	const appearanceLogo = currentPolicy?.standby ? currentPolicy.standby.logoUrl : standbyLogoUrl;
	const appearanceMessage = currentPolicy?.standby?.message ?? standbyMessage;
	const appearanceNext = currentPolicy?.standby ? (currentPolicy.standby.nextBroadcast ?? null) : standbyNextBroadcast;

	const [layout, setLayout] = useState<({ generation: string; corner: typeof watermarkCorner; contentKey: string } & ReturnType<typeof resolveRunnerBrandingPlacement>) | null>(null);
	const measured = layout?.generation === executionGeneration && layout.corner === watermarkCorner ? layout : null;
	const measuredPosition = measured?.status === "placed" ? { left: measured.left, top: measured.top } : null;
	const layoutBlocked = attributionRequired && measured?.status === "blocked";
	useEffect(() => {
		const root = rootRef.current,
			badge = badgeRef.current;
		if (!attributionRequired || !root || !badge) return;
		let frame = 0;
		const observedPanels = new Set<HTMLElement>();
		const measure = () => {
			const surface = root.getBoundingClientRect(),
				badgeBox = badge.getBoundingClientRect();
			const content = root.querySelector("[data-runner-content-phase]");
			const contentKey = content ? [content.getAttribute("data-runner-content-epoch") ?? "", content.getAttribute("data-runner-content-phase") ?? "", content.getAttribute("data-runner-content-id") ?? ""].join(":") : "";
			const reserveInitialPanels = content?.getAttribute("data-runner-content-phase") === "playback" && root.getAttribute("data-runner-layout-content-key") !== contentKey;
			const panels = [...root.querySelectorAll<HTMLElement>("[data-player-overlay]")];
			for (const element of observedPanels)
				if (!panels.includes(element)) {
					resize.unobserve(element);
					observedPanels.delete(element);
				}
			for (const element of panels)
				if (!observedPanels.has(element)) {
					resize.observe(element);
					observedPanels.add(element);
				}
			const occupied = panels
				.filter((element) => getComputedStyle(element).visibility !== "hidden" && (reserveInitialPanels || Number(getComputedStyle(element).opacity) > 0.01))
				.map((element) => {
					const box = element.getBoundingClientRect();
					const style = getComputedStyle(element);
					return expandRunnerOccupiedRect({ left: box.left - surface.left, top: box.top - surface.top, width: box.width, height: box.height }, style.boxShadow, Number.parseFloat(style.scale) || 1);
				});
			const next = resolveRunnerBrandingPlacement({ preferredCorner: watermarkCorner, viewport: { width: surface.width, height: surface.height }, badge: { width: badgeBox.width, height: badgeBox.height }, occupied });
			setLayout((current) => {
				if (current?.generation === executionGeneration && current.corner === watermarkCorner) {
					if (current.status === "blocked" && (next.status === "blocked" || occupied.length === 0)) return current.contentKey === contentKey ? current : { ...current, contentKey };
					if (current.status === "placed" && next.status === "placed" && current.left === next.left && current.top === next.top && current.position === next.position && current.contentKey === contentKey) return current;
				}
				return { generation: executionGeneration, corner: watermarkCorner, contentKey, ...next };
			});
		};
		const schedule = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(measure);
		};
		const resize = new ResizeObserver(schedule);
		resize.observe(root);
		resize.observe(badge);
		const mutations = new MutationObserver((records) => {
			if (records.some((record) => !badge.contains(record.target))) schedule();
		});
		mutations.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class", "data-runner-content-phase", "data-runner-content-epoch", "data-runner-content-id"] });
		window.addEventListener("resize", schedule);
		schedule();
		return () => {
			cancelAnimationFrame(frame);
			resize.disconnect();
			mutations.disconnect();
			window.removeEventListener("resize", schedule);
		};
	}, [attributionRequired, watermarkCorner, executionGeneration]);
	const appearance = resolveRunnerAttributionStyle();
	const placement = resolveRunnerBrandingPlacement({ preferredCorner: watermarkCorner, viewport: { width: 1920, height: 1080 }, badge: { width: 0, height: 0 }, occupied: [] });
	const placementStyle = placement.status === "placed" ? { ...(placement.position.endsWith("right") ? { right: outputSize(1920 - placement.left) } : { left: outputSize(placement.left) }), ...(placement.position.startsWith("bottom") ? { bottom: outputSize(1080 - placement.top) } : { top: outputSize(placement.top) }) } : {};

	return (
		<div ref={rootRef} className='relative h-screen w-screen overflow-hidden bg-black' data-runner-presentation-generation={executionGeneration} data-runner-layout-content-key={measured?.contentKey} data-runner-layout-status={layoutBlocked ? "blocked" : attributionRequired ? (measuredPosition ? "placed" : "pending") : "clean"}>
			{children}
			{standby && (
				<div data-runner-standby className='absolute inset-0' style={{ backgroundColor: effectiveRunnerPro && /^#[0-9a-fA-F]{6}$/.test(appearanceColor) ? appearanceColor : "#000000" }}>
					{effectiveRunnerPro && appearanceBackground?.startsWith("/runner/") && <Image src={appearanceBackground} alt='Standby background' fill sizes='100vw' unoptimized className='object-cover' />}
					{effectiveRunnerPro && (appearanceLogo || appearanceMessage || appearanceNext) && (
						<div className='absolute inset-0 flex flex-col items-center justify-center text-center text-white' style={{ gap: outputSize(32), padding: outputSize(80) }}>
							{appearanceLogo?.startsWith("/runner/") && <Image data-player-overlay='standby-logo' src={appearanceLogo} alt='Standby logo' width={320} height={200} unoptimized style={{ width: outputSize(320), height: outputSize(200), objectFit: "contain", opacity: 1 }} />}
							{appearanceMessage && (
								<p data-player-overlay='standby-message' className='rounded-xl' style={{ fontSize: outputSize(48), lineHeight: 1.25, maxWidth: outputSize(1100), whiteSpace: "pre-wrap", overflowWrap: "anywhere", padding: outputSize(16), background: "rgba(0,0,0,0.6)", opacity: 1 }}>
									{appearanceMessage}
								</p>
							)}
							{appearanceNext && (
								<p data-player-overlay='standby-next-time' className='rounded-xl' style={{ fontSize: outputSize(40), lineHeight: 1.25, padding: outputSize(16), background: "rgba(0,0,0,0.6)", opacity: 1 }}>
									Next broadcast: <LocalizedDate data-runner-next-broadcast data-timezone={appearanceNext.timezone} value={appearanceNext.startUtc} showTime timeZone={appearanceNext.timezone} />
								</p>
							)}
						</div>
					)}
				</div>
			)}
			{layoutBlocked && (
				<p role='alert' className='absolute inset-0 z-[120] flex items-center justify-center bg-black p-6 text-center text-white'>
					Adjust your overlay layout to leave room for Clipify attribution before saving or starting a broadcast.
				</p>
			)}
			{attributionRequired && (
				<aside
					ref={badgeRef}
					aria-label='Livestream powered by Clipify.us'
					data-runner-attribution='true'
					data-runner-attribution-readable={appearance.readable}
					style={{
						position: "absolute",
						...(measuredPosition ? measuredPosition : placementStyle),
						display: "flex",
						alignItems: "center",
						gap: outputSize(appearance.gap),
						padding: outputSize(6),
						borderRadius: outputSize(6),
						background: `rgba(0,0,0,${appearance.backingOpacity})`,
						pointerEvents: "none",
						zIndex: 110,
					}}
				>
					<div style={{ width: outputSize(appearance.logoSize), height: outputSize(appearance.logoSize), opacity: appearance.foregroundOpacity }}>
						<Logo size={0} width='100%' height='100%' aria-hidden='true' />
					</div>
					<div style={{ color: "#fff", fontFamily: "Arial, sans-serif", fontSize: outputSize(appearance.fontSize), lineHeight: outputSize(appearance.lineHeight), fontWeight: 600, minHeight: outputSize(appearance.minTextHeight), whiteSpace: "nowrap", opacity: appearance.foregroundOpacity, WebkitTextStroke: `${outputSize(2)} #000`, paintOrder: "stroke fill", textShadow: `0 0 ${outputSize(4)} #000` }}>
						<span className='block'>Livestream powered</span>
						<span className='block'>by Clipify.us</span>
					</div>
				</aside>
			)}
		</div>
	);
}
