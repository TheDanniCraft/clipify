"use client";

import { useEffect } from "react";
import { driver } from "driver.js";
import { tourModalSelector, tourPopoverSelector, type GuideStep } from "@lib/userTour";

export type SpotlightProps = { step: GuideStep; onPause: () => void; onMissing: () => void; onNext: () => void; onConfirm?: () => void };
export default function Spotlight({ step, onPause, onMissing, onNext, onConfirm }: SpotlightProps) {
	useEffect(() => {
		let disposed = false;
		let shown = false;
		const target = () => document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
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
				if (!disposed) onPause();
			},
		});
		const show = () => {
			if (!disposed && document.querySelector(tourModalSelector)) {
				onPause();
				return;
			}
			const element = target();
			if (shown || disposed || !element) return;
			shown = true;
			spotlight.highlight({
				element,
				popover: {
					title: step.title,
					description: step.description,
					showButtons: step.next || onConfirm ? ["next", "close"] : ["close"],
					nextBtnText: onConfirm ? "I can see clips in OBS / Streamlabs" : "Continue",
					closeBtnLabel: "Pause guide",
					onCloseClick: onPause,
					onNextClick: onConfirm ?? onNext,
					onPopoverRender: ({ wrapper, closeButton }) => {
						wrapper.setAttribute("aria-label", step.title);
						closeButton.setAttribute("aria-label", "Pause guide");
					},
				},
			});
		};
		const keydown = (event: KeyboardEvent) => {
			if (document.querySelector(tourPopoverSelector)) {
				// Let native popover controls own Escape and Tab while they are open.
				if (event.key === "Tab") event.stopPropagation();
				return;
			}
			if (event.key !== "Escape" || document.querySelector(tourModalSelector)) return;
			event.preventDefault();
			event.stopPropagation();
			onPause();
		};
		document.addEventListener("keydown", keydown, true);

		const observer = new MutationObserver(() => {
			if (shown && !target()) {
				onMissing();
				return;
			}
			// Let application dialogs own focus and interaction. Resume after closing them.
			if (document.querySelector(tourModalSelector)) {
				onPause();
				return;
			}
			show();
		});
		observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-tour", "aria-modal", "role"] });
		show();
		const timeout = window.setTimeout(() => {
			if (!shown) {
				show();
				if (!shown) onMissing();
			}
		}, 8000);
		return () => {
			disposed = true;
			document.removeEventListener("keydown", keydown, true);
			observer.disconnect();
			window.clearTimeout(timeout);
			spotlight.destroy();
		};
	}, [step.target, step.title, step.description, step.next, onPause, onMissing, onNext, onConfirm]);
	return null;
}
