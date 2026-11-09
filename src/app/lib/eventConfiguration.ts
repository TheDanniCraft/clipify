import { z } from "zod";
import { eventScheduleSchema } from "./events";
const title = z.string().trim().min(1).max(160);
export const eventSourceSchema = z.enum(["clip", "image", "video", "audio", "text", "link", "youtube", "person", "game", "choice"]);
export const eventRulesSchema = z
	.object({ startedAt: z.iso.datetime({ offset: true }).optional(), endedAt: z.iso.datetime({ offset: true }).optional(), minViews: z.number().int().min(0).optional(), minDuration: z.number().min(0).optional(), maxDuration: z.number().positive().optional(), titleIncludes: z.string().max(200).optional(), titleExcludes: z.string().max(200).optional() })
	.strict()
	.refine((r) => (!r.startedAt || !r.endedAt || Date.parse(r.startedAt) < Date.parse(r.endedAt)) && (r.minDuration === undefined || r.maxDuration === undefined || r.minDuration <= r.maxDuration), "Check the source limits.");
export const categorySchema = z
	.object({ id: z.uuid(), title, group: z.string().trim().max(160).default(""), source: eventSourceSchema, selection: z.enum(["audience", "team", "data"]), submissionLimit: z.number().int().min(1).max(10000).nullable(), nomineeLimit: z.number().int().min(1).max(1000).nullable(), rules: eventRulesSchema, options: z.array(title).max(100), manualResult: z.object({ title, description: z.string().max(5000).default(""), value: z.number().finite().optional() }).optional() })
	.strict()
	.refine((c) => c.source !== "choice" || (c.options.length >= 2 && new Set(c.options).size === c.options.length), "Add at least two distinct choices.");
const statisticSchema = z.object({ label: title, source: z.enum(["manual", "submissions", "categories", "nominees", "voters", "clips"]), value: z.number().finite().optional() }).strict();
export const eventSlideSchema = z.object({ id: z.uuid(), type: z.enum(["welcome", "text", "statistics", "category", "closing"]), title: z.string().max(160), text: z.string().max(5000).default(""), categoryId: z.uuid().optional(), statistics: z.array(statisticSchema).max(100).default([]) }).strict();
export const DEFAULT_AWARD_PRESENTATION = { showChat: false, hiddenAccounts: [] as string[], commandPrefixes: ["!"] };
export const awardPresentationSchema = z
	.object({
		showChat: z.boolean(),
		hiddenAccounts: z
			.array(z.string().max(100))
			.max(100)
			.transform((values) => [...new Set(values.map((value) => value.trim().replace(/^@/, "").toLowerCase()).filter(Boolean))])
			.pipe(z.array(z.string().regex(/^[a-z0-9_]{1,25}$/))),
		commandPrefixes: z
			.array(z.string().max(32))
			.max(20)
			.transform((values) => [...new Set(values.map((value) => value.trim()).filter(Boolean))]),
	})
	.strict();
export const eventInputSchema = z
	.object({
		title,
		description: z.string().max(5000),
		visibility: z.enum(["unlisted", "public"]),
		schedule: eventScheduleSchema,
		votesPerCategory: z.number().int().min(1).max(100),
		tiePolicy: z.enum(["shared", "team"]),
		resultDetail: z.enum(["winner", "percentages", "votes"]),
		whiteLabel: z.boolean(),
		presentation: awardPresentationSchema.default(() => ({ ...DEFAULT_AWARD_PRESENTATION, hiddenAccounts: [], commandPrefixes: [...DEFAULT_AWARD_PRESENTATION.commandPrefixes] })),
		storageConnectionId: z.uuid().nullable().default(null),
		categories: z.array(categorySchema).min(1).max(100),
		slides: z.array(eventSlideSchema).max(500),
	})
	.strict()
	.superRefine((event, ctx) => {
		const ids = new Set(event.categories.map((c) => c.id));
		if (ids.size !== event.categories.length) ctx.addIssue({ code: "custom", message: "Category IDs must be unique.", path: ["categories"] });
		if (new Set(event.slides.map((s) => s.id)).size !== event.slides.length) ctx.addIssue({ code: "custom", message: "Slide IDs must be unique.", path: ["slides"] });
		for (const slide of event.slides) if (slide.type === "category" && (!slide.categoryId || !ids.has(slide.categoryId))) ctx.addIssue({ code: "custom", message: "Choose an existing category.", path: ["slides"] });
	});
export type EventConfiguration = z.infer<typeof eventInputSchema>;
export type EventCategory = z.infer<typeof categorySchema>;
export type EventSource = z.infer<typeof eventSourceSchema>;

export type ManagedAwardEvent = {
	id: string;
	ownerId: string;
	configuration: EventConfiguration;
	revision: number;
	publishedAt: Date | null;
	resultsPublishedAt: Date | null;
	reviewReleased: boolean;
	frozenAt: Date | null;
	frozenResults: Record<string, unknown> | null;
	createdAt: Date;
	updatedAt: Date;
};
