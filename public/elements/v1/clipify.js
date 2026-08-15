const VERSION = 1;
const MODULE_URL = new URL(import.meta.url);
const CLIPIFY_ORIGIN = MODULE_URL.origin;
const STYLE_ID = "clipify-elements-v1-styles";

function installDocumentStyles() {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
		dialog[data-clipify-dialog="v1"] { all: initial; position: fixed; inset: 0; box-sizing: border-box; width: min(var(--clipify-dialog-modal-width, 960px), calc(100vw - 48px), calc(133.333dvh - 64px)); height: auto; aspect-ratio: 4 / 3; max-width: none; max-height: calc(100dvh - 48px); margin: auto; padding: 0; border: 0; overflow: visible; background: transparent; color: white; }
		dialog[data-clipify-dialog="v1"]::backdrop { background: var(--clipify-dialog-modal-backdrop, rgb(0 0 0 / 72%)); }
		dialog[data-clipify-dialog="v1"] > iframe { display: block; width: 100%; height: 100%; border: 0; background: transparent; color-scheme: light dark; }
		dialog[data-clipify-dialog="v1"] > button { position: absolute; z-index: 2; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); width: 42px; height: 42px; border: 0; border-radius: 999px; background: #18181b; color: #fff; font: 28px/1 sans-serif; cursor: pointer; }
		@media (max-width: 639px) { dialog[data-clipify-dialog="v1"] { width: 100vw; height: 100dvh; } }
	`;
	document.head.append(style);
}

function readRuntimeStyles(element) {
	const computed = getComputedStyle(element);
	const names = ["--clipify-accent", "--clipify-card-surface", "--clipify-text", "--clipify-radius", "--clipify-gap", "--clipify-background", "--clipify-modal-backdrop", "--clipify-modal-width"];
	return Object.fromEntries(names.map((name) => [name, computed.getPropertyValue(name).trim()]).filter(([, value]) => value));
}

class ClipifyBaseElement extends HTMLElement {
	constructor() {
		super();
		this._root = this.attachShadow({ mode: "open" });
		this._frame = null;
		this._port = null;
		this._loadHandler = null;
	}

	disconnectedCallback() {
		this._destroyFrame();
	}

	_destroyFrame() {
		this._port?.close();
		this._port = null;
		if (this._frame && this._loadHandler) this._frame.removeEventListener("load", this._loadHandler);
		this._frame?.remove();
		this._frame = null;
		this._loadHandler = null;
	}

	_connectFrame(frame, elementType, resourceId, extra = {}) {
		this._frame = frame;
		this._loadHandler = () => {
			if (!frame.contentWindow) return;
			this._port?.close();
			const channel = new MessageChannel();
			this._port = channel.port1;
			channel.port1.start();
			this._onPort(channel.port1, elementType, resourceId);
			frame.contentWindow.postMessage({ version: VERSION, type: "clipify:init", elementType, resourceId, styles: readRuntimeStyles(this), ...extra }, CLIPIFY_ORIGIN, [channel.port2]);
		};
		frame.addEventListener("load", this._loadHandler);
	}

	_onPort() {}
}

class ClipifyGalleryElement extends ClipifyBaseElement {
	static get observedAttributes() {
		return ["gallery-id"];
	}

	constructor() {
		super();
		this._dialog = null;
		this._dialogFrame = null;
		this._dialogPort = null;
		this._failureTimer = null;
		this._escapeHandler = null;
		this._previousOverflow = "";
		this._scrollLockActive = false;
		this._allowRuntimeStyles = false;
	}

	connectedCallback() {
		this._render();
	}
	attributeChangedCallback() {
		if (this.isConnected) this._render();
	}
	disconnectedCallback() {
		this._closeDialog(false);
		super.disconnectedCallback();
	}

	_render() {
		this._destroyFrame();
		this._allowRuntimeStyles = false;
		const galleryId = this.getAttribute("gallery-id")?.trim();
		this._root.innerHTML = `<style>:host{display:block;width:100%;contain:layout style}.wrap{display:block;width:100%;min-height:320px}.frame{display:block;width:100%;height:320px;border:0;background:transparent}.error{padding:20px;border:1px solid #ef4444;border-radius:12px;font:14px/1.5 system-ui;color:#b91c1c}</style><div class="wrap"></div>`;
		const wrap = this._root.querySelector(".wrap");
		if (!galleryId) {
			wrap.innerHTML = `<div class="error">A gallery-id is required.</div>`;
			return;
		}
		const frame = document.createElement("iframe");
		frame.className = "frame";
		frame.title = "Clipify clip gallery";
		frame.loading = "lazy";
		frame.referrerPolicy = "strict-origin";
		wrap.append(frame);
		this._connectFrame(frame, "gallery", galleryId);
		frame.src = new URL(`/gallery/${encodeURIComponent(galleryId)}/frame`, CLIPIFY_ORIGIN).href;
	}

	_onPort(port, elementType, resourceId) {
		port.onmessage = (event) => {
			const message = event.data;
			if (!message || message.version !== VERSION || message.elementType !== elementType || message.resourceId !== resourceId) return;
			if (message.type === "ready") this._allowRuntimeStyles = message.allowRuntimeStyles === true;
			if (message.type === "resize" && Number.isFinite(message.height)) {
				const height = Math.min(10_000, Math.max(120, Math.ceil(message.height)));
				if (this._frame && this._frame.style.height !== `${height}px`) this._frame.style.height = `${height}px`;
			}
			if (message.type === "selected-clip" && typeof message.clipId === "string") this._openDialog(resourceId, message.clipId);
		};
	}

	_openDialog(galleryId, clipId) {
		this._closeDialog(false);
		installDocumentStyles();
		const dialog = document.createElement("dialog");
		dialog.dataset.clipifyDialog = "v1";
		const runtime = this._allowRuntimeStyles ? readRuntimeStyles(this) : {};
		for (const [name, value] of Object.entries(runtime)) dialog.style.setProperty(name, value);
		if (runtime["--clipify-modal-width"]) dialog.style.setProperty("--clipify-dialog-modal-width", runtime["--clipify-modal-width"]);
		if (runtime["--clipify-modal-backdrop"]) dialog.style.setProperty("--clipify-dialog-modal-backdrop", runtime["--clipify-modal-backdrop"]);
		const fallbackClose = document.createElement("button");
		fallbackClose.type = "button";
		fallbackClose.ariaLabel = "Close Clipify player";
		fallbackClose.textContent = "×";
		fallbackClose.hidden = true;
		const failureNotice = document.createElement("div");
		failureNotice.hidden = true;
		failureNotice.style.cssText = "position:absolute;left:12px;right:64px;bottom:12px;z-index:3;padding:10px 12px;border-radius:12px;background:rgb(24 24 27 / 0.92);color:#fff;font:13px/1.4 system-ui;box-shadow:0 10px 28px rgb(0 0 0 / 28%);";
		failureNotice.textContent = "Clipify could not fully initialize this modal. The page may block modal dialogs or cross-window messaging.";
		const frame = document.createElement("iframe");
		frame.title = "Clipify clip player";
		frame.allow = "autoplay";
		frame.referrerPolicy = "strict-origin";
		frame.src = new URL(`/gallery/${encodeURIComponent(galleryId)}/clip/${encodeURIComponent(clipId)}`, CLIPIFY_ORIGIN).href;
		dialog.append(frame, failureNotice, fallbackClose);
		document.body.append(dialog);
		this._dialog = dialog;
		this._dialogFrame = frame;
		let initialized = false;
		const sendInit = () => {
			if (initialized || !this._dialog || !frame.contentWindow) return;
			initialized = true;
			const channel = new MessageChannel();
			this._dialogPort = channel.port1;
			channel.port1.start();
			channel.port1.onmessage = (event) => {
				const message = event.data;
				if (!message || message.version !== VERSION || message.elementType !== "player" || message.resourceId !== galleryId) return;
				if (message.type === "ready") {
					clearTimeout(this._failureTimer);
					this._failureTimer = null;
					fallbackClose.hidden = true;
					failureNotice.hidden = true;
				}
				if (message.type === "resize" && Number.isFinite(message.height) && matchMedia("(min-width: 640px)").matches) {
					const height = Math.min(window.innerHeight - 48, Math.max(320, Math.ceil(message.height)));
					if (dialog.style.height !== `${height}px`) dialog.style.height = `${height}px`;
				}
				if (message.type === "close") this._closeDialog(true);
			};
			frame.contentWindow.postMessage({ version: VERSION, type: "clipify:init", elementType: "player", resourceId: galleryId, clipId, styles: runtime }, CLIPIFY_ORIGIN, [channel.port2]);
		};
		if (!this._scrollLockActive) {
			this._previousOverflow = document.documentElement.style.overflow;
			this._scrollLockActive = true;
			document.documentElement.style.overflow = "hidden";
		}
		this._failureTimer = setTimeout(() => {
			fallbackClose.hidden = false;
			failureNotice.hidden = false;
		}, 8000);
		frame.addEventListener(
			"load",
			() => {
				if (!frame.contentWindow) {
					fallbackClose.hidden = false;
					failureNotice.hidden = false;
					return;
				}
				window.requestAnimationFrame(sendInit);
			},
			{ once: true },
		);
		fallbackClose.addEventListener("click", () => this._closeDialog(true), { once: true });
		dialog.addEventListener(
			"cancel",
			(event) => {
				event.preventDefault();
				this._closeDialog(true);
			},
			{ once: true },
		);
		this._escapeHandler = (event) => {
			if (event.key !== "Escape" || !this._dialog) return;
			event.preventDefault();
			this._closeDialog(true);
		};
		document.addEventListener("keydown", this._escapeHandler, true);
		dialog.addEventListener("close", () => this._closeDialog(true), { once: true });
		dialog.addEventListener("click", (event) => {
			if (event.target === dialog) this._closeDialog(true);
		});
		try {
			dialog.showModal();
		} catch (error) {
			console.warn("[Clipify] modal showModal() failed, falling back to non-modal dialog", error);
			dialog.setAttribute("open", "");
			dialog.style.zIndex = "2147483647";
			fallbackClose.hidden = false;
			failureNotice.hidden = false;
		}
	}

	_closeDialog(restoreFocus) {
		clearTimeout(this._failureTimer);
		this._failureTimer = null;
		this._dialogPort?.close();
		this._dialogPort = null;
		this._dialogFrame?.remove();
		this._dialogFrame = null;
		if (this._dialog) {
			const dialog = this._dialog;
			this._dialog = null;
			if (dialog.open) dialog.close();
			dialog.remove();
		}
		if (this._scrollLockActive) {
			document.documentElement.style.overflow = this._previousOverflow;
			this._previousOverflow = "";
			this._scrollLockActive = false;
		}
		if (this._escapeHandler) {
			document.removeEventListener("keydown", this._escapeHandler, true);
			this._escapeHandler = null;
		}
		if (restoreFocus) {
			this._port?.postMessage({ version: VERSION, type: "restore-focus", elementType: "gallery", resourceId: this.getAttribute("gallery-id") });
		}
	}
}

class ClipifyPlayerElement extends ClipifyBaseElement {
	static get observedAttributes() {
		return ["player-id", "muted", "autoplay", "show-banner", "show-overlay"];
	}
	connectedCallback() {
		this._render();
	}
	attributeChangedCallback() {
		if (this.isConnected) this._render();
	}

	_render() {
		this._destroyFrame();
		const playerId = this.getAttribute("player-id")?.trim();
		this._root.innerHTML = `<style>:host{display:block;width:100%;aspect-ratio:16/9}.frame{display:block;width:100%;height:100%;border:0;background:transparent}.error{padding:20px;border:1px solid #ef4444;border-radius:12px;font:14px/1.5 system-ui;color:#b91c1c}</style>`;
		if (!playerId) {
			this._root.innerHTML += `<div class="error">A player-id is required.</div>`;
			return;
		}
		const url = new URL(`/embed/${encodeURIComponent(playerId)}`, CLIPIFY_ORIGIN);
		for (const [attribute, parameter] of [
			["muted", "muted"],
			["autoplay", "autoplay"],
			["show-banner", "showBanner"],
			["show-overlay", "showOverlay"],
		])
			if (this.hasAttribute(attribute)) url.searchParams.set(parameter, "true");
		const frame = document.createElement("iframe");
		frame.className = "frame";
		frame.title = "Clipify clip player";
		frame.loading = "lazy";
		frame.allow = "autoplay";
		frame.referrerPolicy = "strict-origin";
		frame.src = url.href;
		this._root.append(frame);
		this._frame = frame;
	}
}

if (!customElements.get("clipify-gallery")) customElements.define("clipify-gallery", ClipifyGalleryElement);
if (!customElements.get("clipify-player")) customElements.define("clipify-player", ClipifyPlayerElement);
