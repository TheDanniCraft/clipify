"use client";

// shortcut: Native custom events count as interactions for bounce; revisit if Umami adds passive events.
/** Incremental measurements use native numeric events; no visitor ID or persistent state. */
export function startEngagementTracking(send: (payload: Record<string, unknown>) => void) {
	let page: Record<string, unknown> | null = null;
	let activeSince: number | null = null;
	let activeMs = 0;
	let maximumDepth = 0;
	let sentDepth = 0;

	const depth = () => Math.min(100, Math.max(0, ((window.scrollY + window.innerHeight) / Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight, 1)) * 100));
	const measure = () => {
		maximumDepth = Math.max(maximumDepth, depth());
	};
	const flush = () => {
		if (!page) return;
		if (activeSince !== null) {
			activeMs += performance.now() - activeSince;
			activeSince = performance.now();
		}
		measure();
		const increment = Math.max(0, Math.round(maximumDepth) - sentDepth);
		if (activeMs > 0 || increment > 0) {
			send({ ...page, name: "page_engagement", data: { active_ms: Math.round(activeMs), scroll_increment: increment } });
			activeMs = 0;
			sentDepth += increment;
		}
	};
	const pause = () => {
		flush();
		activeSince = null;
	};
	const resume = () => {
		if (document.visibilityState === "visible" && document.hasFocus() && activeSince === null) activeSince = performance.now();
	};
	const visibility = () => {
		if (document.visibilityState === "hidden") pause();
		else resume();
	};
	const navigate = (event: Event) => {
		flush();
		page = { ...(event as CustomEvent<Record<string, unknown>>).detail };
		activeMs = 0;
		maximumDepth = 0;
		sentDepth = 0;
		activeSince = null;
		measure();
		resume();
	};
	const interaction = (name: string, data: Record<string, string> = {}) => {
		if (page) send({ ...page, name, data });
	};
	const click = (event: MouseEvent) => {
		if (event.type === "auxclick" && event.button !== 1) return;
		const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
		if (!link || link.hasAttribute("data-umami-event")) return;
		try {
			const url = new URL(link.href, window.location.href);
			if (!/^https?:$/.test(url.protocol)) return;
			if (url.host !== window.location.host) interaction("Outbound Link: Click", { destination_host: url.hostname, destination_path: url.pathname });
			else if (link.hasAttribute("download") || /\.(?:pdf|xlsx?|docx?|txt|csv|zip|rar|7z|exe|msi|apk|pkg|deb|rpm|mp4|mpeg|wmv|midi|mp3|wav|wma|dmg)$/i.test(url.pathname)) interaction("File Download", { destination_path: url.pathname });
		} catch {
			/* Invalid destinations are not analytics events. */
		}
	};
	const submit = () => interaction("Form: Submission");
	document.addEventListener("click", click, true);
	document.addEventListener("auxclick", click, true);
	document.addEventListener("submit", submit, true);
	window.addEventListener("clipify:analytics-pageview", navigate);
	window.addEventListener("scroll", measure, { passive: true });
	window.addEventListener("resize", measure);
	window.addEventListener("focus", resume);
	window.addEventListener("blur", pause);
	window.addEventListener("pagehide", pause);
	document.addEventListener("visibilitychange", visibility);
	return () => {
		pause();
		document.removeEventListener("click", click, true);
		document.removeEventListener("auxclick", click, true);
		document.removeEventListener("submit", submit, true);
		window.removeEventListener("clipify:analytics-pageview", navigate);
		window.removeEventListener("scroll", measure);
		window.removeEventListener("resize", measure);
		window.removeEventListener("focus", resume);
		window.removeEventListener("blur", pause);
		window.removeEventListener("pagehide", pause);
		document.removeEventListener("visibilitychange", visibility);
	};
}
