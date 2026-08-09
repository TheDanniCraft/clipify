"use client";

import { Carousel } from "@heroui-pro/react/carousel";
import type { Gallery, TwitchClip } from "@types";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./GalleryFrame.module.css";

type Props = {
	gallery: Gallery;
	clips: TwitchClip[];
	ownerName: string;
	showAttribution: boolean;
	onSelectClip?: (clip: TwitchClip) => void;
};

const PROTOCOL_VERSION = 1;

function formatDuration(duration: number) {
	const minutes = Math.floor(duration / 60);
	return `${minutes}:${String(Math.floor(duration % 60)).padStart(2, "0")}`;
}

function ClipCard({ clip, gallery, onSelect, horizontal = false }: { clip: TwitchClip; gallery: Gallery; onSelect: (clip: TwitchClip) => void; horizontal?: boolean }) {
	return (
		<button className={`${styles.card} ${horizontal ? styles.horizontal : styles.vertical} ${gallery.listDensity === "compact" ? styles.compact : ""}`} type='button' onClick={() => onSelect(clip)} aria-label={`Play ${clip.title}`}>
			<span className={styles.imageWrap}>
				<img className={styles.thumbnail} src={clip.thumbnail_url} alt='' loading='lazy' />
				{gallery.showDuration ? <span className={styles.duration}>{formatDuration(clip.duration)}</span> : null}
			</span>
			<span className={styles.meta}>
				{gallery.showTitle ? <span className={styles.title}>{clip.title}</span> : null}
				<span className={styles.details}>
					{gallery.showCreator ? <span>{clip.creator_name}</span> : null}
					{gallery.showViews ? <span>{clip.view_count.toLocaleString()} views</span> : null}
					{gallery.showCreatedAt ? <time dateTime={clip.created_at}>{new Date(clip.created_at).toLocaleDateString()}</time> : null}
				</span>
			</span>
		</button>
	);
}

export default function GalleryFrame({ gallery, clips, ownerName, showAttribution, onSelectClip }: Props) {
	const portRef = useRef<MessagePort | null>(null);
	const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastHeight = useRef(0);
	const lastFocusedCard = useRef<HTMLElement | null>(null);
	const [runtimeStyle, setRuntimeStyle] = useState<CSSProperties>({});
	const isPro = !showAttribution;
	const frameStyle = useMemo(
		() =>
			({
				"--mobile-columns": gallery.gridMobileColumns,
				"--tablet-columns": gallery.gridTabletColumns,
				"--desktop-columns": gallery.gridDesktopColumns,
				"--mobile-cards": gallery.carouselMobileCards,
				"--tablet-cards": gallery.carouselTabletCards,
				"--desktop-cards": gallery.carouselDesktopCards,
				"--clipify-accent": isPro ? gallery.accentColor : "#7C3AED",
				"--clipify-card": isPro ? gallery.cardSurfaceColor : "#18181B",
				"--clipify-text": isPro ? gallery.textColor : "#FFFFFF",
				"--clipify-radius": `${isPro ? gallery.cardRadius : 16}px`,
				"--clipify-gap": `${isPro ? gallery.gap : 16}px`,
				"--clipify-background": isPro && gallery.backgroundMode === "solid" ? gallery.backgroundColor : "transparent",
				"--clipify-thumbnail-fit": isPro ? gallery.thumbnailTreatment : "cover",
			}) as CSSProperties,
		[gallery, isPro],
	);

	useEffect(() => {
		let expectedParentOrigin = "";
		try {
			expectedParentOrigin = document.referrer ? new URL(document.referrer).origin : "";
		} catch {
			expectedParentOrigin = "";
		}
		const onMessage = (event: MessageEvent) => {
			if (!expectedParentOrigin || event.origin !== expectedParentOrigin || event.source !== window.parent || event.data?.version !== PROTOCOL_VERSION || event.data?.type !== "clipify:init" || event.data?.elementType !== "gallery" || event.data?.resourceId !== gallery.id || !event.ports[0]) return;
			portRef.current?.close();
			portRef.current = event.ports[0];
			portRef.current.start();
			portRef.current.onmessage = (portEvent) => {
				const message = portEvent.data;
				if (message?.version !== PROTOCOL_VERSION || message?.elementType !== "gallery" || message?.resourceId !== gallery.id) return;
				if (message.type === "restore-focus") lastFocusedCard.current?.focus({ preventScroll: true });
			};
			if (isPro && event.data.styles && typeof event.data.styles === "object") {
				const incoming = event.data.styles as Record<string, unknown>;
				const next: Record<string, string> = {};
				const colors = [
					["--clipify-accent", "--clipify-accent"],
					["--clipify-card-surface", "--clipify-card"],
					["--clipify-text", "--clipify-text"],
					["--clipify-background", "--clipify-background"],
				] as const;
				for (const [source, target] of colors) if (typeof incoming[source] === "string" && CSS.supports("color", incoming[source] as string)) next[target] = incoming[source] as string;
				for (const name of ["--clipify-radius", "--clipify-gap"] as const) if (typeof incoming[name] === "string" && /^\d+(?:\.\d+)?px$/.test(incoming[name] as string)) next[name] = incoming[name] as string;
				setRuntimeStyle(next as CSSProperties);
			}
			portRef.current.postMessage({ version: PROTOCOL_VERSION, type: "ready", elementType: "gallery", resourceId: gallery.id, allowRuntimeStyles: isPro });
		};
		window.addEventListener("message", onMessage);
		const observer = new ResizeObserver(() => {
			if (resizeTimer.current) clearTimeout(resizeTimer.current);
			resizeTimer.current = setTimeout(() => {
				const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
				if (height === lastHeight.current || height < 1) return;
				lastHeight.current = height;
				portRef.current?.postMessage({ version: PROTOCOL_VERSION, type: "resize", elementType: "gallery", resourceId: gallery.id, height });
			}, 80);
		});
		observer.observe(document.documentElement);
		return () => {
			window.removeEventListener("message", onMessage);
			observer.disconnect();
			if (resizeTimer.current) clearTimeout(resizeTimer.current);
			portRef.current?.close();
		};
	}, [gallery.id, isPro]);

	const selectClip = (clip: TwitchClip) => {
		lastFocusedCard.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		if (onSelectClip) {
			onSelectClip(clip);
			return;
		}
		portRef.current?.postMessage({ version: PROTOCOL_VERSION, type: "selected-clip", elementType: "gallery", resourceId: gallery.id, clipId: clip.id });
	};
	const cards = clips.map((clip) => <ClipCard key={clip.id} clip={clip} gallery={gallery} onSelect={selectClip} horizontal={gallery.layout === "list"} />);

	return (
		<main className={styles.frame} style={{ ...frameStyle, ...runtimeStyle }}>
			{clips.length === 0 ? <div className={styles.empty}>No clips are available yet.</div> : null}
			{gallery.layout === "grid" ? <div className={gallery.gridAuto ? styles.autoGrid : styles.grid}>{cards}</div> : null}
			{gallery.layout === "list" ? <div className={styles.list}>{cards}</div> : null}
			{gallery.layout === "carousel" && clips.length > 0 ? (
				<Carousel opts={{ align: "start" }}>
					<Carousel.Content>
						{clips.map((clip) => (
							<Carousel.Item key={clip.id} className={styles.carouselItem}>
								<ClipCard clip={clip} gallery={gallery} onSelect={selectClip} />
							</Carousel.Item>
						))}
					</Carousel.Content>
					{gallery.carouselShowNavigation ? (
						<>
							<Carousel.Previous />
							<Carousel.Next />
						</>
					) : null}
					{gallery.carouselShowIndicators ? <Carousel.Dots /> : null}
				</Carousel>
			) : null}
			{showAttribution ? (
				<a className={styles.attribution} href={`https://clipify.us/gallery?utm_source=clipify_gallery&utm_medium=attribution&utm_campaign=${encodeURIComponent(gallery.id)}`} target='_blank' rel='noreferrer'>
					Clip gallery by {ownerName} · Powered by Clipify
				</a>
			) : null}
		</main>
	);
}
