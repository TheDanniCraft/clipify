import "server-only";
import { UseSend } from "usesend-js";

type Contact = { id: string; email: string; [key: string]: unknown };

/** Read only the exporting account's newsletter records; never create or update contacts. */
export async function collectExternalAccountData(emails: string[]) {
	const support = { status: "external_request_required", included: false, description: "Support conversations are held in Chatwoot, not in the Clipify database. Request your support-conversation data by emailing contact@clipify.us from your account email." };
	const base = process.env.USESEND_BASE_URL;
	const key = process.env.USESEND_API_KEY;
	const bookIds = [...new Set([process.env.USESEND_CONTACT_BOOK_ID, process.env.USESEND_PRODUCT_UPDATES_CONTACT_BOOK_ID].filter((id): id is string => Boolean(id)))];
	if (!base || !key || !bookIds.length) return { support, newsletter: { status: "not_configured", contacts: [] as Contact[], description: "Newsletter provider access is not configured for this deployment. Local subscription and consent settings are included in identity/settings.json." } };
	const client = new UseSend(key, base.replace(/\/+$/, ""));
	const addresses = new Set(emails.map((email) => email.toLowerCase()));
	const contacts: Contact[] = [];
	try {
		for (const book of bookIds) {
			for (const email of addresses) {
				const result = await client.fetchRequest<Contact[]>(`/contactBooks/${encodeURIComponent(book)}/contacts?emails=${encodeURIComponent(email)}`, { method: "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
				if (result.error || !Array.isArray(result.data)) throw new Error("NEWSLETTER_EXPORT_UNAVAILABLE");
				for (const contact of result.data) {
					if (typeof contact.email === "string" && addresses.has(contact.email.toLowerCase()) && !contacts.some((existing) => existing.id === contact.id)) contacts.push(contact);
				}
			}
		}
		return { support, newsletter: { status: "included", contacts, description: "Newsletter contact data for this account's verified email identifiers. Local settings and consent history are included separately." } };
	} catch {
		return { support, newsletter: { status: "unavailable", contacts, description: "The newsletter provider could not return every requested record. Local settings are included. Contact contact@clipify.us for the missing provider data." } };
	}
}
