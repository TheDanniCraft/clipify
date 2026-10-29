import type { Faq } from "@types";

const faqs: Faq[] = [
	{ title: "Does Clipify work with OBS and Streamlabs?", content: "Yes. Clipify plays through a browser source, so it fits into your BRB, Starting Soon, or intermission scene. Connect Twitch, choose clips, save an overlay, and add its URL to your streaming software." },
	{ title: "Can I choose which clips play?", content: "Yes. Save a handpicked playlist or use a clip source and filters. You can come back to the same setup for your next stream and change the selection without replacing the OBS browser source." },
	{ title: "Can I get started for free?", content: "Yes. Free includes a clip player, one overlay and one playlist with up to 50 clips. Eligible new creators also receive seven days of Pro without a card. When that access ends, you continue on Free unless you choose a paid plan." },
	{ title: "Can my moderators help control playback?", content: "Pro includes remote playback controls, Twitch chat commands, channel points and team access. Trusted teammates can use their own accounts to help manage clips and playback." },
	{ title: "What should I check before going live?", content: "Test your break scene, browser-source audio and the switch back to gameplay. Check the clip selection too. The public demo is silent; use your own OBS audio settings to route sound for your stream." },
	{ title: "Do I have to install Runner?", content: "No. An OBS browser-source setup works without Runner. The optional self-hosted Runner is included with Free and Pro and broadcasts from your own Windows, Linux, or macOS computer, which must stay online." },
];

export default faqs;
