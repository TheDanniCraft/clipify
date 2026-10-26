"use client";

import { useEffect } from "react";
import { driver } from "driver.js";
import { tourModalSelector, tourPopoverSelector, type GuideStep } from "@lib/userTour";

export type SpotlightProps = { step: GuideStep; onPause: () => void; onMissing: () => void; onNext: () => void; onConfirm?: () => void };
export default function Spotlight({ step, onPause, onMissing, onNext, onConfirm }: SpotlightProps) {
	useEffect(() => {
		let disposed = false;
		let shown = false;
		let suspended = false;
		let advanced = false;
		let missingTimer: ReturnType<typeof setTimeout> | undefined;
		const preserveAria = (element: HTMLElement | null, action: () => void) => {
			const values = ["aria-expanded", "aria-haspopup", "aria-controls"].map((name) => [name, element?.getAttribute(name)] as const);
			action();
			if (element)
				for (const [name, value] of values) {
					if (value == null) element.removeAttribute(name);
					else element.setAttribute(name, value);
				}
		};
		const target = () => {
			if (step.target === "support-report") return document.querySelector("#sentry-feedback")?.shadowRoot?.querySelector<HTMLElement>(".widget__actor") ?? null;
			if (step.target === "support-chat") return document.querySelector<HTMLElement>('[aria-label="Enable support chat"], .woot--bubble-holder');
			return document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
		};
		const spotlight = driver({
			animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
			overlayOpacity: 0.55,
			stagePadding: 8,
			stageRadius: 10,
			disableActiveInteraction: false,
			allowKeyboardControl: false,
			overlayClickBehavior: "none",
			popoverClass: "clipify-tour-popover",
			onDestroyed: () => {
				if (!disposed && !suspended) onPause();
			},
		});
		const show = () => {
			if (disposed) return;
			if (document.querySelector("#consent-banner-title")) {
				onPause();
				return;
			}
			if (document.querySelector(tourModalSelector)) {
				if (!step.allowDialog) {
					onPause();
					return;
				}
				if (!suspended) {
					suspended = true;
					if (shown) preserveAria(target(), () => spotlight.destroy());
					shown = false;
				}
				return;
			}
			suspended = false;
			const element = target();
			if (step.reveals && document.querySelector(`[data-tour="${step.reveals}"]`)) {
				if (!advanced) {
					advanced = true;
					onNext();
				}
				return;
			}
			if (step.action && element?.getAttribute("role") === "tab" && element.getAttribute("aria-selected") === "true") {
				if (!advanced) {
					advanced = true;
					onNext();
				}
				return;
			}
			if (shown || disposed || !element) return;
			shown = true;
			element.scrollIntoView?.({ block: "center", behavior: "instant" });
			preserveAria(element, () =>
				spotlight.highlight({
					element,
					disableActiveInteraction: element.dataset.tourReadonly === "true",
					popover: {
						title: step.title,
						description: step.description,
						showButtons: step.preserveFocus ? [] : (step.next && !step.action) || onConfirm ? ["next", "close"] : ["close"],
						nextBtnText: step.nextLabel ?? "Continue",
						closeBtnLabel: "Pause guide",
						onCloseClick: onPause,
						onNextClick: onConfirm ?? onNext,
						onPopoverRender: ({ wrapper, closeButton }) => {
							wrapper.setAttribute("aria-label", step.title);
							closeButton.setAttribute("aria-label", "Pause guide");
						},
					},
				}),
			);
		};
		const click = (event: MouseEvent) => {
			const control = target();
			if (step.pauseOnInteract && control && event.composedPath().includes(control)) {
				onPause();
				return;
			}
			if (step.action && !step.reveals && !advanced && target()?.getAttribute("role") !== "tab" && event.target instanceof Node && target()?.contains(event.target)) {
				advanced = true;
				onNext();
			}
		};
		document.addEventListener("click", click, true);
		const keydown = (event: KeyboardEvent) => {
			if (document.querySelector(tourPopoverSelector)) {
				// Let native popover controls own Escape and Tab while they are open.
				if (event.key === "Tab") event.stopPropagation();
				return;
			}
			if (event.key !== "Escape" || document.querySelector(`${tourModalSelector}, #consent-banner-title`)) return;
			event.preventDefault();
			event.stopPropagation();
			onPause();
		};
		document.addEventListener("keydown", keydown, true);

		const observer = new MutationObserver(() => {
			if (shown && !target()) {
				if (step.destination) {
					missingTimer ??= setTimeout(() => {
						if (!disposed && !target()) onMissing();
					}, 8000);
				} else onMissing();
				return;
			}

			show();
		});
		observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-tour", "aria-modal", "role", "aria-selected"] });
		show();
		const timeout = window.setTimeout(() => {
			if (!shown && !suspended && !advanced) {
				show();
				if (!shown && !suspended && !advanced) onMissing();
			}
		}, 8000);
		return () => {
			disposed = true;
			document.removeEventListener("keydown", keydown, true);
			document.removeEventListener("click", click, true);
			observer.disconnect();
			window.clearTimeout(timeout);
			clearTimeout(missingTimer);
			preserveAria(target(), () => spotlight.destroy());
		};
	}, [step.target, step.title, step.description, step.next, step.action, step.allowDialog, step.preserveFocus, step.destination, step.reveals, step.pauseOnInteract, step.nextLabel, onPause, onMissing, onNext, onConfirm]);
	return null;
}
