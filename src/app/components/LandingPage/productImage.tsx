import Image from "next/image";
import theme from "../../../../public/product/theme.webp";
import themeMobile from "../../../../public/product/theme-mobile.webp";
import playlist from "../../../../public/product/playlist.webp";
import playlistMobile from "../../../../public/product/playlist-mobile.webp";
import overlay from "../../../../public/product/overlay.webp";
import overlayMobile from "../../../../public/product/overlay-mobile.webp";
import controls from "../../../../public/product/controls.webp";
import controlsMobile from "../../../../public/product/controls-mobile.webp";
import selection from "../../../../public/product/selection.webp";
import broadcast from "../../../../public/product/broadcast.webp";

const productImages = {
	theme: { alt: "Theme Studio typography and background color controls with the color picker open", desktop: theme, mobile: themeMobile },
	playlist: { alt: "Clipify playlist editor with selected clips and saved playlist controls", desktop: playlist, mobile: playlistMobile },
	overlay: { alt: "Clipify overlay settings with a saved playlist and playback options", desktop: overlay, mobile: overlayMobile },
	controls: { alt: "Clipify remote playback controls for pause, skip and mute", desktop: controls, mobile: controlsMobile },
	selection: { alt: "Selecting Twitch highlights in Clipify's playlist editor", desktop: selection, mobile: null },
	broadcast: { alt: "Twitch highlights playing through the Clipify player", desktop: broadcast, mobile: null },
} as const;

export default function ProductImage({ view, className = "" }: { view: keyof typeof productImages; className?: string }) {
	const image = productImages[view];
	return (
		<picture className={`block min-w-0 overflow-hidden rounded-xl ${className}`}>
			{image.mobile && <source media='(max-width: 480px)' srcSet={`${image.mobile.src} 3x`} width={image.mobile.width} height={image.mobile.height} />}
			<Image unoptimized src={image.desktop} alt={image.alt} sizes={view === "broadcast" ? "(max-width: 1024px) 100vw, 720px" : "(max-width: 767px) 100vw, (max-width: 1024px) 50vw, 768px"} loading='lazy' className='h-auto w-full' />
		</picture>
	);
}
