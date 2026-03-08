"use server";

import { UseSend } from "usesend-js";
import { tryRateLimit } from "@actions/rateLimit";
import { RateLimitError } from "@types";
import { verifyTurnstile } from "nextjs-turnstile";

const USESEND_BASE_URL = process.env.USESEND_BASE_URL;
const USESEND_API_KEY = process.env.USESEND_API_KEY;
const USESEND_CONTACT_BOOK_ID = process.env.USESEND_CONTACT_BOOK_ID;

type NewsletterContactDetails = {
	firstName?: string;
	properties?: Record<string, string>;
};

function getUseSendClient() {
	if (!USESEND_BASE_URL || !USESEND_API_KEY || !USESEND_CONTACT_BOOK_ID) {
		throw new Error("Missing useSend configuration in environment variables");
	}

	const baseUrl = USESEND_BASE_URL.replace(/\/+$/, "");
	return {
		client: new UseSend(USESEND_API_KEY, baseUrl),
		contactBookId: USESEND_CONTACT_BOOK_ID,
	};
}

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

export async function subscribeToNewsletter(email: string, captchaToken: string, details?: NewsletterContactDetails) {
	const { client, contactBookId } = getUseSendClient();

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

		const payload = {
			email,
			subscribed: true,
			...(details?.firstName ? { firstName: details.firstName } : {}),
			...(details?.properties ? { properties: details.properties } : {}),
		};

		const response = await client.contacts.create(contactBookId, payload);
		if (response.error) {
			throw new Error(response.error.message || "useSend contact creation failed");
		}

		return response.data;
	} catch (error: unknown) {
		console.error("Newsletter subscription error:", error);
		return error instanceof Error ? error : new Error("Failed to subscribe to newsletter");
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
