"use server";

import axios from "axios";
import { tryRateLimit } from "@actions/rateLimit";
import { RateLimitError } from "@types";
import { verifyTurnstile } from "nextjs-turnstile";

const LISTMONK_URL = process.env.LISTMONK_URL;
const LISTMONK_LIST_UUID = process.env.LISTMONK_LIST_UUID;
const LISTMONK_USERNAME = process.env.LISTMONK_USERNAME;
const LISTMONK_API_KEY = process.env.LISTMONK_API_KEY;

// List of most popular email providers
const providerPatterns = [
	{ regex: /@(gmail\.com|googlemail\.com)$/i, provider: "Google" },
	{ regex: /@(outlook\.com|hotmail\.com|live\.com|msn\.com)$/i, provider: "Microsoft" },
	{ regex: /@(yahoo\.(com|co\.\w+)|ymail\.com)$/i, provider: "Yahoo" },
	{ regex: /@(icloud\.com|me\.com|mac\.com)$/i, provider: "Apple" },
	{ regex: /@aol\.com$/i, provider: "AOL" },
	{ regex: /@(protonmail\.com|pm\.me)$/i, provider: "ProtonMail" },
	{ regex: /@gmx\.(com|de)$/i, provider: "GMX" },
	{ regex: /@mail\.com$/i, provider: "Mail.com" },
	{ regex: /@web\.de$/i, provider: "WEB.DE" },
	{ regex: /@t-online\.de$/i, provider: "T-Online" },
	{ regex: /@zoho\.com$/i, provider: "Zoho" },
	{ regex: /@yandex\.(com|ru)$/i, provider: "Yandex" },
	{ regex: /@(mail|rambler)\.ru$/i, provider: "Russia Mail" },
	{ regex: /@(qq\.com|163\.com|126\.com|yeah\.net)$/i, provider: "NetEase" },
	{ regex: /@sina\.(com|cn)$/i, provider: "Sina Mail" },
	{ regex: /@(naver\.com|hanmail\.net|daum\.net)$/i, provider: "Korea Mail" },
	{ regex: /@rediffmail\.com$/i, provider: "Rediffmail" },
	{ regex: /@(bol\.com\.br|uol\.com\.br)$/i, provider: "UOL/BOL" },
	{ regex: /@(libero|alice|tin|virgilio)\.it$/i, provider: "TIM/Italy Mail" },
	{ regex: /@(orange\.fr|wanadoo\.fr)$/i, provider: "Orange" },
	{ regex: /@free\.fr$/i, provider: "Free" },
	{ regex: /@skynet\.be$/i, provider: "Proximus" },
	{ regex: /@(planet|hetnet)\.nl$/i, provider: "KPN" },
	{ regex: /@seznam\.cz$/i, provider: "Seznam" },
	{ regex: /@inbox\.lv$/i, provider: "Inbox.lv" },
	{ regex: /@(o2|wp|onet)\.pl$/i, provider: "Polish Mail" },
	{ regex: /@laposte\.net$/i, provider: "La Poste" },
	{ regex: /@shaw\.ca$/i, provider: "Shaw" },
	{ regex: /@telus\.net$/i, provider: "Telus" },
	{ regex: /@(btinternet|btopenworld)\.com$/i, provider: "BT" },
	{ regex: /@(bellsouth|att)\.net$/i, provider: "AT&T" },
];

export async function subscribeToNewsletter(email: string, captchaToken: string) {
	if (!LISTMONK_URL || !LISTMONK_LIST_UUID || !LISTMONK_USERNAME || !LISTMONK_API_KEY) {
		throw new Error("Missing Listmonk configuration in environment variables");
	}

	try {
		const rateLimiter = await tryRateLimit({ key: "newsletter", points: 1, duration: 60 });

		if (!rateLimiter.success) {
			return new RateLimitError();
		}

		const isValidCaptcha = await verifyTurnstile(captchaToken, {
			secretKey: process.env.TURNSTILE_SECRET_KEY || "",
		});

		if (!isValidCaptcha) {
			return new Error("Invalid CAPTCHA");
		}

		const response = await axios.post(
			`${LISTMONK_URL}/api/public/subscription`,
			{
				email,
				list_uuids: [LISTMONK_LIST_UUID],
				status: "enabled",
			},
			{
				headers: {
					"Content-Type": "application/json",
					Authorization: `Basic ${Buffer.from(`${LISTMONK_USERNAME}:${LISTMONK_API_KEY}`).toString("base64")}`,
				},
			},
		);

		return response.data;
	} catch (error: unknown) {
		if (axios.isAxiosError(error)) {
			console.error("Axios error:", {
				message: error.message,
				response: error.response?.data,
			});
		} else {
			console.error("Unknown error:", error);
		}

		throw new Error("Failed to subscribe to newsletter");
	}
}

export async function getEmailProvider(email: string) {
	const lowerEmail = email.toLowerCase();
	for (const { regex, provider } of providerPatterns) {
		if (regex.test(lowerEmail)) {
			return provider;
		}
	}
	return "custom";
}
