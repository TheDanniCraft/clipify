"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import { driver } from "driver.js";
import { tourModalSelector, tourPopoverSelector, type GuideStep } from "@lib/userTour";

export type SpotlightProps = { step: GuideStep; onPause: () => void; onMissing: () => void; onNext: () => void; onPrevious?: () => void; onConfirm?: () => void };
export default function Spotlight({ step, onPause, onMissing, onNext, onPrevious, onConfirm }: SpotlightProps) {
	const [popoverHost, setPopoverHost] = useState<HTMLElement | null>(null);
	const driverRef = useRef<ReturnType<typeof driver> | null>(null);
	useLayoutEffect(() => {
		const wrapper = popoverHost?.parentElement;
		if (!wrapper) return;
		const refresh = () => driverRef.current?.refresh();
		const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refresh);
		observer?.observe(wrapper);
		refresh();
		return () => observer?.disconnect();
	}, [popoverHost]);
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
			onHighlighted: () => spotlight.refresh(),
			onDestroyed: () => {
				if (!disposed && !suspended) onPause();
			},
		});
		driverRef.current = spotlight;
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
						showButtons: [],
						nextBtnText: step.nextLabel ?? "Continue",
						closeBtnLabel: "Pause guide",
						onCloseClick: onPause,
						onNextClick: onConfirm ?? onNext,
						onPopoverRender: ({ wrapper, closeButton }) => {
							wrapper.setAttribute("aria-label", step.title);
							closeButton.setAttribute("aria-label", "Pause guide");
							const host = document.createElement("div");
							wrapper.appendChild(host);
							setPopoverHost(host);
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
			if (shown) spotlight.refresh();
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
	}, [step.target, step.title, step.description, step.next, step.action, step.allowDialog, step.preserveFocus, step.destination, step.reveals, step.pauseOnInteract, step.nextLabel, onPause, onMissing, onNext, onPrevious, onConfirm]);
	return popoverHost && !step.preserveFocus
		? createPortal(
				<>
					<Button isIconOnly size='sm' variant='ghost' aria-label='Pause guide' className='absolute right-2 top-2' onPress={onPause}>
						<IconX size={16} />
					</Button>
					{(onPrevious || (step.next && !step.action) || onConfirm) && (
						<div className='mt-4 flex items-center justify-between gap-2'>
							{onPrevious ? (
								<Button size='sm' variant='secondary' data-tour-action='back' onPress={onPrevious}>
									Back
								</Button>
							) : (
								<span />
							)}
							{((step.next && !step.action) || onConfirm) && (
								<Button size='sm' variant='primary' data-tour-action='next' onPress={onConfirm ?? onNext}>
									{step.nextLabel ?? "Continue"}
								</Button>
							)}
						</div>
					)}
				</>,
				popoverHost,
			)
		: null;
}
