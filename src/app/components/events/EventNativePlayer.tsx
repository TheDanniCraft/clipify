"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, Label, Slider, Switch } from "@heroui/react";
import { attachEventAudio } from "@lib/eventAudio";

const preferenceKey = "clipify-event-audio";
type Settings = { volume: number; muted: boolean; leveling: boolean };
const defaults: Settings = { volume: 0.8, muted: false, leveling: false };
type PlayerProps = { src: string; title: string; audio?: boolean; onError: () => void };
const subscribeToHydration = () => () => undefined;
const clientReady = () => true;
const serverReady = () => false;
export default function EventNativePlayer(props: PlayerProps) {
	const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
	return ready ? (
		<NativePlayer {...props} />
	) : (
		<p role='status' className='p-4 text-sm text-muted'>
			Loading player…
		</p>
	);
}
function readSettings(): Settings {
	try {
		const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? "null");
		if (saved && Number.isFinite(saved.volume) && saved.volume >= 0 && saved.volume <= 1 && typeof saved.muted === "boolean" && typeof saved.leveling === "boolean") return { volume: saved.volume, muted: saved.muted, leveling: saved.leveling };
	} catch {
		/* Storage is optional in private browsing. */
	}
	return defaults;
}
function NativePlayer({ src, title, audio = false, onError }: PlayerProps) {
	const media = useRef<HTMLMediaElement | null>(null),
		engine = useRef<ReturnType<typeof attachEventAudio>>(null);
	const [settings, setSettings] = useState(readSettings),
		[unavailable, setUnavailable] = useState(false);
	const sameOrigin = new URL(src, window.location.href).origin === window.location.origin;
	useEffect(() => {
		return () => {
			engine.current?.dispose();
			engine.current = null;
		};
	}, [src, unavailable]);
	useEffect(() => {
		if (!media.current) return;
		media.current.volume = settings.volume;
		media.current.muted = settings.muted;
		try {
			localStorage.setItem(preferenceKey, JSON.stringify(settings));
		} catch {
			/* Playback works without storage. */
		}
		if (settings.leveling && sameOrigin && !unavailable && !engine.current) engine.current = attachEventAudio(media.current, () => setUnavailable(true));
		engine.current?.setEnabled(settings.leveling && !unavailable);
	}, [settings, sameOrigin, src, unavailable]);
	const props = {
		ref: (element: HTMLMediaElement | null) => {
			media.current = element;
		},
		src,
		controls: true,
		autoPlay: true,
		playsInline: true,
		preload: "metadata",
		onError,
		"aria-label": title,
		className: audio ? "w-full" : "aspect-video max-h-[55dvh] w-full bg-black object-contain",
		onVolumeChange: () => {
			if (media.current) {
				const { volume, muted } = media.current;
				setSettings((current) => (current.volume === volume && current.muted === muted ? current : { ...current, volume, muted }));
			}
		},
	};
	return (
		<div className='flex h-full min-h-0 w-full flex-col justify-center gap-3'>
			{audio ? <audio key={`${src}:${unavailable}`} {...props} /> : <video key={`${src}:${unavailable}`} {...props} />}
			<div className='flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-xl bg-surface-secondary px-3 py-2 text-sm'>
				<Button size='sm' variant='tertiary' aria-label={settings.muted ? "Unmute event audio" : "Mute event audio"} onPress={() => setSettings((current) => ({ ...current, muted: !current.muted }))}>
					{settings.muted ? "Unmute" : "Mute"}
				</Button>
				<Slider aria-label='Event volume' value={Math.round(settings.volume * 100)} onChange={(value) => setSettings((current) => ({ ...current, volume: Number(value) / 100 }))} className='w-28' minValue={0} maxValue={100}>
					<Slider.Track>
						<Slider.Fill />
						<Slider.Thumb />
					</Slider.Track>
				</Slider>
				<Switch aria-label='Level audio' isSelected={settings.leveling && !unavailable} isDisabled={!sameOrigin || unavailable} onChange={(leveling) => setSettings((current) => ({ ...current, leveling }))}>
					<Switch.Content>
						<Switch.Control>
							<Switch.Thumb />
						</Switch.Control>
						<Label>Level audio</Label>
					</Switch.Content>
				</Switch>
				{unavailable || !sameOrigin ? (
					<span role={unavailable ? "status" : undefined} className='text-xs text-muted'>
						Audio leveling is unavailable for this media.
					</span>
				) : null}
			</div>
		</div>
	);
}
