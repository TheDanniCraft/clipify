"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./FakeTwitchChat.css";
import { Modal, ModalBody, ModalContent, ModalHeader, useDisclosure } from "@heroui/react";

type ChatMsg = {
	id: string;
	user: string;
	color: string;
	text: string;
	isMod?: boolean;
	isSub?: boolean;
	isBroadcaster?: boolean;
	isRewardRedemption?: boolean;
	rewardName?: string;
};

type Props = {
	isLive: boolean;
	title?: string;
	selfUser?: string;
	selfColor?: string;
	initialCount?: number;
	rateMs?: number;
	maxMessages?: number;
	seed?: string;
	onCommand?: (cmd: string, args: string[], raw: string) => void;
	onRedeem?: (rewardName: string, input: string) => void;
};

const REWARD_NAME = "Add clip to queue";

const USERS = [
	{ user: "clipify", color: "#a78bfa", isBroadcaster: true },
	{ user: "mod_mila", color: "#22c55e", isMod: true },
	{ user: "sub_sven", color: "#60a5fa", isSub: true },
	{ user: "pixel_panda", color: "#fb923c" },
	{ user: "coffee_cat", color: "#f87171" },
	{ user: "nix_ninja", color: "#34d399" },
	{ user: "gamer_gabe", color: "#f59e0b" },
	{ user: "hype_hannah", color: "#ef4444" },
	{ user: "tech_tom", color: "#06b6d4" },
	{ user: "lucky_lucy", color: "#f472b6", isSub: true },
	{ user: "toast_tim", color: "#f97316" },
	{ user: "chill_chris", color: "#60a5fa" },
	{ user: "rebecca", color: "#a3e635" },
	{ user: "alex_streams", color: "#8b5cf6" },
	{ user: "thedannicraft", color: "#f43f5e" },
	{ user: "derdummbabbler", color: "#9ae6b4" },
];

const PHRASES = ["lol", "nice", "W", "LMAO", "clean", "pog", "gg", ":fire:", ":joy:", ":skull:", "first", "omg", "no way", "that was pog", "so good", "brb", "hype", "what", "haha", "clap", "nice clip", "insane", "<3"];

const EMOTES: Record<string, string> = {
	fire: "🔥",
	joy: "😂",
	skull: "💀",
};

function emojify(text: string) {
	return text.replace(/:([a-z0-9_]+):/gi, (_, k: string) => EMOTES[k.toLowerCase()] ?? `:${k}:`);
}

function clampTail<T>(arr: T[], max: number) {
	return arr.length <= max ? arr : arr.slice(arr.length - max);
}

function hashSeed(s: string) {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function uidFromRng(rng: () => number) {
	return `s${Math.floor(rng() * 1_000_000_000).toString(36)}`;
}

function makeSeededMsg(rng: () => number): ChatMsg {
	const u = USERS[Math.floor(rng() * USERS.length)];
	const text = PHRASES[Math.floor(rng() * PHRASES.length)];
	return {
		id: uidFromRng(rng),
		user: u.user,
		color: u.color,
		text,
		isMod: u.isMod,
		isSub: u.isSub,
		isBroadcaster: u.isBroadcaster,
	};
}

function uid() {
	return Math.random().toString(36).slice(2, 10);
}

function makeLiveMsg(): ChatMsg {
	const u = USERS[Math.floor(Math.random() * USERS.length)];
	const text = PHRASES[Math.floor(Math.random() * PHRASES.length)];
	return {
		id: uid(),
		user: u.user,
		color: u.color,
		text,
		isMod: u.isMod,
		isSub: u.isSub,
		isBroadcaster: u.isBroadcaster,
	};
}

function parseCommand(text: string) {
	const raw = text.trim();
	if (!raw.startsWith("!")) return null;
	const parts = raw.slice(1).split(/\s+/).filter(Boolean);
	if (!parts.length) return null;
	const [cmd, ...args] = parts;
	return { cmd: cmd.toLowerCase(), args, raw };
}

function isTwitchClipUrl(text: string) {
	try {
		const u = new URL(text.trim());
		const host = u.hostname.replace(/^www\./, "").toLowerCase();
		if (host === "clips.twitch.tv") return true;
		if (host === "twitch.tv" || host.endsWith(".twitch.tv")) {
			return u.pathname.toLowerCase().includes("/clip/");
		}
		return false;
	} catch {
		return false;
	}
}

export default function FakeTwitchChat({ isLive, title = "STREAM CHAT", selfUser = "you", selfColor = "#eab308", initialCount = 14, rateMs = 900, maxMessages = 50, seed = "fake-chat", onCommand, onRedeem }: Props) {
	const [msgs, setMsgs] = useState<ChatMsg[]>(() => {
		const rng = mulberry32(hashSeed(seed));
		const count = Math.max(0, Math.min(initialCount, maxMessages));
		const out: ChatMsg[] = [];
		for (let i = 0; i < count; i++) out.push(makeSeededMsg(rng));
		return out;
	});

	const [input, setInput] = useState("");
	const [cpArmed, setCpArmed] = useState(false);
	const [cpError, setCpError] = useState<string | null>(null);
	const { isOpen, onOpen, onOpenChange } = useDisclosure();

	const listRef = useRef<HTMLDivElement | null>(null);
	const [autoScroll, setAutoScroll] = useState(true);

	const headerRight = useMemo(() => (isLive ? "LIVE" : "OFFLINE"), [isLive]);

	const pushMessage = useCallback(
		(m: ChatMsg) => {
			setMsgs((p) => clampTail([...p, m], maxMessages));
		},
		[maxMessages]
	);

	useEffect(() => {
		if (!isLive) return;

		let stopped = false;
		let t: number | undefined;

		const schedule = () => {
			const jitter = 0.6 + Math.random() * 1.1;
			t = window.setTimeout(() => {
				if (stopped) return;
				pushMessage(makeLiveMsg());
				schedule();
			}, Math.round(rateMs * jitter));
		};

		schedule();
		return () => {
			stopped = true;
			if (t) window.clearTimeout(t);
		};
	}, [isLive, rateMs, pushMessage]);

	useEffect(() => {
		if (!autoScroll) return;
		const el = listRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [msgs, autoScroll]);

	const submit = () => {
		const text = input.trim();
		if (!text) return;

		setCpError(null);

		if (cpArmed) {
			if (!isTwitchClipUrl(text)) {
				setCpError("Please paste a valid Twitch clip link.");
				return;
			}

			onRedeem?.(REWARD_NAME, text);

			pushMessage({
				id: uid(),
				user: selfUser,
				color: selfColor,
				text,
				isRewardRedemption: true,
				rewardName: REWARD_NAME,
			});

			setInput("");
			setCpArmed(false);
			return;
		}

		const cmd = parseCommand(text);
		if (cmd) {
			onCommand?.(cmd.cmd, cmd.args, cmd.raw);
		}

		pushMessage({ id: uid(), user: selfUser, color: selfColor, text });

		setInput("");
	};

	return (
		<div className='tchat'>
			<div className='tchat__header'>
				<div className='tchat__title'>{title}</div>
				<div className={`tchat__status ${isLive ? "live" : ""}`}>
					{isLive && <span className='tchat__liveDot' aria-hidden />}
					{headerRight}
				</div>
			</div>

			<div
				className='tchat__list'
				ref={listRef}
				onScroll={() => {
					const el = listRef.current;
					if (!el) return;
					setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
				}}
			>
				{msgs.map((m) => (
					<div key={m.id} className={`tchat__msg ${m.isRewardRedemption ? "reward" : ""}`}>
						{m.isRewardRedemption && (
							<div className='tchat__rewardHeader'>
								<span className='tchat__rewardLabel'>Reward redeemed</span>
								<span className='tchat__rewardName'>{m.rewardName ?? REWARD_NAME}</span>
							</div>
						)}

						<div className='tchat__msgLine'>
							<span className='tchat__badges'>
								{m.isBroadcaster && <span className='b'>⬤</span>}
								{m.isMod && <span className='b'>🛡</span>}
								{m.isSub && <span className='b'>★</span>}
							</span>

							<span className='tchat__user' style={{ color: m.color }}>
								{m.user}
							</span>
							<span className='tchat__sep'>:</span>
							<span className='tchat__text'>{emojify(m.text)}</span>
						</div>
					</div>
				))}
			</div>

			{!cpArmed && (
				<div className={"tchat__hint"} onClick={onOpen}>
					Click to see a list of commands
				</div>
			)}
			{(cpArmed || cpError) && <div className={`tchat__redeem ${cpError ? "isError" : ""}`}>{cpError ?? `Redeem reward: ${REWARD_NAME}`}</div>}

			<Modal isOpen={isOpen} onOpenChange={onOpenChange}>
				<ModalContent>
					<ModalHeader className='flex flex-col gap-1'>Available Commands</ModalHeader>
					<ModalBody>
						{(() => {
							const cmds = [
								{
									name: "!play",
									desc: "Resume playback or play a clip URL",
									examples: ["!play", "!play https://clips.twitch.tv/ExampleClip"],
								},
								{ name: "!pause", desc: "Pause playback", examples: ["!pause"] },
								{ name: "!skip", desc: "Skip to next clip", examples: ["!skip"] },
								{ name: "!hide", desc: "Hide the player", examples: ["!hide"] },
								{ name: "!show", desc: "Show the player", examples: ["!show"] },
							];
							return (
								// force single-column full-width cards so long descriptions don't break layout
								<div className='grid gap-3 grid-cols-1'>
									{cmds.map((c) => (
										<div key={c.name} className='bg-card/60 border border-neutral-200/20 dark:border-neutral-800/60 rounded-md p-3 w-full overflow-hidden'>
											<div className='flex items-start justify-between gap-3'>
												<div>
													<div className='inline-flex items-center gap-2'>
														<span className='px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold text-sm'>{c.name}</span>
														<span className='text-sm text-muted-foreground'>{c.desc}</span>
													</div>
												</div>
											</div>

											<div className='mt-2 flex flex-col gap-2'>
												{c.examples.map((ex, i) => (
													<div key={i} className='text-xs font-mono text-muted-foreground bg-muted/40 rounded px-2 py-1 whitespace-normal wrap-break-word'>
														{ex}
													</div>
												))}
											</div>
										</div>
									))}
								</div>
							);
						})()}
					</ModalBody>
				</ModalContent>
			</Modal>

			<form
				className='tchat__inputRow'
				onSubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				<button
					type='button'
					className={`tchat__cp ${cpArmed ? "armed" : ""}`}
					onClick={() => {
						setCpError(null);
						setCpArmed((v) => !v);
					}}
					disabled={!isLive}
				>
					⬤
				</button>

				<div className='tchat__inputWrap'>
					<input className='tchat__input' value={input} onChange={(e) => setInput(e.target.value)} placeholder={!isLive ? "Chat is offline…" : cpArmed ? "Paste a Twitch clip link…" : "Send a message…"} disabled={!isLive} />
				</div>

				<button className='tchat__send' type='submit' disabled={!isLive || !input.trim()}>
					Chat
				</button>
			</form>
		</div>
	);
}
