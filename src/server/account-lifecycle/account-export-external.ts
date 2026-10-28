import "server-only";
import { UseSend } from "usesend-js";
import { z } from "zod";

type Contact = { id: string; email: string; [key: string]: unknown };

/** Match external records only to server-verified account emails and the bound creator ID. */
export async function collectExternalAccountData(emails: string[], creatorId: string) {
	const supportData = await collectSupportAccountData(emails, creatorId);
	const support = supportData ? { support: supportData } : {};
	const base = process.env.USESEND_BASE_URL;
	const key = process.env.USESEND_API_KEY;
	const bookIds = [...new Set([process.env.USESEND_CONTACT_BOOK_ID, process.env.USESEND_PRODUCT_UPDATES_CONTACT_BOOK_ID].filter((id): id is string => Boolean(id)))];
	if (!base || !key || !bookIds.length) return { ...support, newsletter: { status: "not_configured", contacts: [] as Contact[], description: "Newsletter provider access is not configured for this deployment. Local subscription and consent settings are included in account/account.json#/settings." } };
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
		return { ...support, newsletter: { status: "included", contacts, description: "Newsletter contact data for this account's verified email identifiers. Local settings and consent history are included separately." } };
	} catch {
		return { ...support, newsletter: { status: "unavailable", contacts, description: "The newsletter provider could not return every requested record. Local settings are included. Contact contact@clipify.us for the missing provider data." } };
	}
}

const supportTimestamp = z
	.union([z.number(), z.string()])
	.transform((value) => (typeof value === "number" ? new Date(value * 1000).toISOString() : value))
	.nullish();
const supportId = z.number().int().positive();
const supportContactSchema = z.object({
	id: supportId,
	contact_inboxes: z.array(z.object({ inbox: z.object({ id: supportId }) })).optional(),
	identifier: z.string().nullish(),
	email: z.string().nullish(),
	name: z.string().nullish(),
	phone_number: z.string().nullish(),
	created_at: supportTimestamp,
	last_activity_at: supportTimestamp,
	additional_attributes: z.record(z.string(), z.unknown()).optional(),
	custom_attributes: z.record(z.string(), z.unknown()).optional(),
});
const supportConversationSchema = z.object({
	id: supportId,
	status: z.string(),
	inbox_id: supportId,
	created_at: supportTimestamp,
	updated_at: supportTimestamp,
	last_activity_at: supportTimestamp,
	labels: z.array(z.string()).optional(),
	custom_attributes: z.record(z.string(), z.unknown()).optional(),
	meta: z.object({ sender: z.object({ id: supportId }) }),
});
const supportMessageSchema = z.object({
	id: supportId,
	conversation_id: supportId,
	private: z.boolean(),
	message_type: z.number().int(),
	content: z.string().nullish(),
	content_type: z.string().optional(),
	created_at: supportTimestamp,
	updated_at: supportTimestamp,
	status: z.string().optional(),
	sender: z.object({ id: supportId, name: z.string().nullish(), type: z.string().optional() }).nullish(),
	attachments: z.array(z.object({ id: supportId, file_type: z.string().optional(), data_url: z.string().nullish(), thumb_url: z.string().nullish(), file_size: z.number().optional(), extension: z.string().nullish(), width: z.number().nullish(), height: z.number().nullish() })).optional(),
});

async function collectSupportAccountData(emails: string[], creatorId: string) {
	const base = process.env.CHATWOOT_BASE_URL;
	const accountId = process.env.CHATWOOT_ACCOUNT_ID;
	const key = process.env.CHATWOOT_API_TOKEN;
	const inboxIds = process.env.CHATWOOT_INBOX_IDS;
	if (!base && !accountId && !key && !inboxIds) return undefined;
	try {
		if (!base || !key || !accountId || !inboxIds || !/^[1-9]\d*$/.test(accountId)) throw new Error("Invalid support configuration");
		const allowedInboxes = new Set(
			z
				.array(supportId)
				.min(1)
				.parse(inboxIds.split(",").map((id) => Number(id.trim()))),
		);
		const origin = new URL(base);
		if (origin.protocol !== "https:") throw new Error("Support export requires HTTPS");
		const signal = AbortSignal.timeout(60_000);
		async function request(path: string, payload?: unknown) {
			const response = await fetch(new URL(`/api/v1/accounts/${accountId}${path}`, origin), {
				method: payload ? "POST" : "GET",
				headers: { api_access_token: key!, "Content-Type": "application/json" },
				...(payload ? { body: JSON.stringify(payload) } : {}),
				cache: "no-store",
				redirect: "error",
				signal,
			});
			if (!response.ok) throw new Error("Support provider request failed");
			return response.json() as Promise<unknown>;
		}
		const addresses = new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean));
		const filters = [{ attribute_key: "identifier", filter_operator: "equal_to", values: [creatorId], query_operator: addresses.size ? "OR" : null }, ...(addresses.size ? [{ attribute_key: "email", filter_operator: "equal_to", values: [...addresses], query_operator: null }] : [])];
		const contacts = new Map<number, z.infer<typeof supportContactSchema>>();
		const contactIds = new Set<number>();
		for (let page = 1; ; page++) {
			const { payload } = z.object({ payload: z.array(supportContactSchema) }).parse(await request(`/contacts/filter?page=${page}&include_contact_inboxes=true`, { payload: filters }));
			if (!payload.length) break;
			for (const contact of payload) {
				if (contactIds.has(contact.id)) throw new Error("Support contact pagination did not advance");
				contactIds.add(contact.id);
				if (contact.identifier && contact.identifier !== creatorId) continue;
				if (contact.email && !addresses.has(contact.email.toLowerCase())) continue;
				if (contact.identifier !== creatorId && !contact.email) continue;
				const contactInboxes = (contact.contact_inboxes ?? []).filter((entry) => allowedInboxes.has(entry.inbox.id));
				if (!contactInboxes.length) continue;
				contacts.set(contact.id, { ...contact, contact_inboxes: contactInboxes });
			}
		}
		const conversations: Array<Omit<z.infer<typeof supportConversationSchema>, "meta"> & { contactId: number; messages: z.infer<typeof supportMessageSchema>[] }> = [];
		for (const contact of contacts.values()) {
			const conversationIds = new Set<number>();
			for (let page = 1; ; page++) {
				const { payload } = z.object({ payload: z.array(supportConversationSchema) }).parse(
					await request(`/conversations/filter?page=${page}`, {
						payload: [
							{ attribute_key: "contact_id", filter_operator: "equal_to", values: [contact.id], query_operator: "AND" },
							{ attribute_key: "inbox_id", filter_operator: "equal_to", values: [...allowedInboxes], query_operator: null },
						],
					}),
				);
				if (!payload.length) break;
				for (const conversation of payload) {
					const { meta: conversationMeta, ...details } = conversation;
					if (conversationMeta.sender.id !== contact.id || !allowedInboxes.has(conversation.inbox_id) || conversationIds.has(conversation.id)) throw new Error("Support conversation ownership or pagination mismatch");
					conversationIds.add(conversation.id);
					const messages: z.infer<typeof supportMessageSchema>[] = [];
					let before: number | undefined;
					for (;;) {
						const { payload: batch, meta } = z.object({ payload: z.array(supportMessageSchema), meta: z.object({ contact: z.object({ id: supportId }) }) }).parse(await request(`/conversations/${conversation.id}/messages?filter_internal_messages=true${before === undefined ? "" : `&before=${before}`}`));
						if (meta.contact.id !== contact.id) throw new Error("Support message ownership mismatch");
						if (!batch.length) break;
						for (const message of batch) {
							if (message.conversation_id !== conversation.id || (before !== undefined && message.id >= before)) throw new Error("Support message ownership or pagination mismatch");
							if (!message.private && [0, 1, 3].includes(message.message_type)) messages.push(message);
						}
						before = Math.min(...batch.map((message) => message.id));
					}
					conversations.push({ ...details, contactId: contact.id, messages: messages.sort((a, b) => a.id - b.id) });
				}
			}
		}
		return { status: "included", contacts: [...contacts.values()], conversations };
	} catch {
		// A configured source must not silently become a complete-looking, partial export.
		throw new Error("CHATWOOT_EXPORT_UNAVAILABLE");
	}
}
