type Faq = {
	title: string;
	content: string;
};

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
		content: "Yes! You can choose to play clips from today, all-time, or just your featured clips.",
	},
	{
		title: "Is there a free version of Clipify?",
		content: "Yes, Clipify offers a free version with basic features. You can also upgrade to Pro for additional features.",
	},
	{
		title: "What are the benefits of the Pro version?",
		content: "The Pro version includes features like multiple active overlays, channel points integration, and priority support.",
	},
	{
		title: "Can I use Clipify on multiple channels?",
		content: "Yes, you can use Clipify on any channel you manage. Just set it up for each channel individually.",
	},
];

export default faqs;
