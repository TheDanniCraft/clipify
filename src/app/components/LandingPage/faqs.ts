import type { Faq } from "@types";

const faqs: Faq[] = [
	{ title: "What do I need to use Clipify?", content: "A Twitch account with clips and streaming software that supports browser sources, such as OBS Studio or Streamlabs. Sign in, choose your clips, and add your saved overlay URL to a browser source in your break scene. You do not need to install Runner for an OBS browser-source setup." },
	{ title: "Why do I connect my Twitch account?", content: "Your account keeps your clip selection, playlists, and overlay settings together so you can manage them and return to the same setup for your next stream. Twitch sign-in connects that setup to your creator account." },
	{ title: "What can I do for free?", content: "Free is an ongoing plan. It includes one overlay, one playlist with up to 50 clips, a branded gallery, a Creator Page, and manual Runner broadcasting. Your available clip library has no clip-count limit; the 50-clip limit applies to an individual Free playlist." },
	{ title: "Can I try Pro before paying?", content: "Eligible new creators receive seven days of Pro access without entering card details. After that access ends, you continue on Free unless you choose a paid plan. Returning creators do not receive another new-creator trial." },
	{ title: "Can I choose exactly which clips play?", content: "Yes. Handpick clips for a saved playlist or use clip filters. Free includes Random playback. Pro adds advanced filters, Top and Smart Shuffle modes, and imports that create or refresh a playlist when you request them." },
	{ title: "Can I skip clips or let moderators help?", content: "Pro includes a remote control panel to pause, skip, mute, and manage playback. It also includes Twitch chat controls, channel points integration, and editor or manager access for trusted teammates." },
	{ title: "How do I handle audio and switching scenes?", content: "Add Clipify to your BRB or Starting Soon scene and check the browser source's audio and visibility settings in your streaming software. Test both the break scene and the return to gameplay before going live. The demo on this page plays without sound." },
	{ title: "Do I need the self-hosted Runner?", content: "Runner is optional and included with Free and Pro. It broadcasts from your own Windows, Linux, or macOS computer, which must stay online. Pro adds advanced broadcasting tools. You can use the OBS browser-source player without Runner." },
	{ title: "What happens if I cancel Pro?", content: "Pro remains available through your paid-through date. Afterward, Free limits apply. Your saved overlays, playlists, galleries, and settings are kept; additional resources and Pro-only controls become unavailable until you upgrade again." },
];

export default faqs;
