import { Faq } from "@types";

const faqs: Faq[] = [
	{
		title: "What is Clipify?",
		content: "Clipify is a tool that automatically plays your best Twitch clips to keep your channel active and your viewers engaged, even when you're away.",
	},
	{
		title: "How do I set up Clipify?",
		content: "Setting up Clipify is easy! Just add a browser source to your streaming software and configure it to play your Twitch clips.",
	},
	{
		title: "What streaming software do you support?",
		content: "Clipify works with any streaming software that supports browser sources, including OBS Studio, Streamlabs, and XSplit.",
	},
	{
		title: "Can I control which clips are played?",
		content: "Yes! You can choose use different filters to control which clips are played, such as time range, minimum views, duration, or even specific keywords in the title. Alternatively you can use Playlist to handpick the clips you want to play.",
	},
	{
		title: "What are playlists?",
		content: "Normally, Clipify automatically selects clips based on your filters (e.g. last week). But with Playlists, you can handpick specific clips to play, even in a custom order. This gives you full control over the content that gets showcased on your stream.",
	},
	{
		title: "Is there a free version of Clipify?",
		content: "Yes, Clipify offers a free version with basic features. You can also upgrade to Pro for additional features.",
	},
	{
		title: "Can I embed Clipify on my website?",
		content: "Yes, Clipify provides an embed feature that allows you to showcase your clips on your website or blog.",
	},
	{
		title: "Can I allow others to manage my overlay settings (mods, managers etc.)?",
		content: "Yes, you can add editors to help manage your overlay settings. Just make sure not to add yourself as an editor.",
	},
	{
		title: "Can I customize the overlays to match my stream's branding?",
		content: "Yes, with Theme Studio you can fully customize the look and feel of your overlays to match your stream's branding. You can adjust colors, fonts, effects, and more to create a unique and cohesive visual experience for your viewers.",
	},
	{
		title: "What can I customize in Theme Studio?",
		content: "You can drag and position overlay cards, resize them, nudge with arrow keys, customize colors/fonts/effects, and style the timer and progress bar to match your stream branding.",
	},
	{
		title: "Can I control my overlay while not on my PC?",
		content: "Yes, with the remote control feature you can fully control the overlay remotely. Want to skip a clip whilst taking a break? Or want to change the volume? All possible.",
	},
	{
		title: "Can moderators control the overlay during a stream?",
		content: "Yes, your moderators can either use the chat commands (can be used by all Channel Moderators) or the remote control panel if you add them as editors in the dashboard.",
	},
	{
		title: "What are the benefits of the Pro version?",
		content: "The Pro version includes Theme Studio, advanced playback filters, multiple active overlays, channel points integration, the remote control panel, editor access for teammates, and priority support.",
	},
	{
		title: "Can I use Clipify on multiple channels?",
		content: "Yes, you can use Clipify on any channel you manage. Just set it up for each channel individually.",
	},
];

export default faqs;
