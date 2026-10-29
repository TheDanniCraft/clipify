/* eslint-disable @typescript-eslint/no-require-imports */
const gitmojis = require("./gitmojis.json");

function validatePullRequestTitle(title) {
	const emoji = typeof title === "string" && gitmojis.find((value) => title.startsWith(`${value} `));
	const message = emoji && title.slice(emoji.length + 1);
	if (!emoji || title.trim() !== title || /[\r\n]/.test(title) || [...title].length >= 60 || !/^[A-Z][a-z]+\s/.test(message) || /\p{Extended_Pictographic}/u.test(message)) {
		throw new Error("PR title must use one Gitmoji, a capitalized action verb, and fewer than 60 characters (for example: 🐛 Fix OAuth refresh).");
	}
}

module.exports = { validatePullRequestTitle };
if (require.main === module) {
	const event = JSON.parse(require("node:fs").readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
	validatePullRequestTitle(event.pull_request?.title);
	console.log("PR title is suitable for the squash commit.");
}
