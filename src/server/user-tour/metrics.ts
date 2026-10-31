import { sql, type SQL } from "drizzle-orm";
import type { QueryClient } from "@/db/client";
import { userContentStatesTable } from "@/db/schema";
import { guideContentKey, journeys, type UserTourStats } from "@lib/userTour";

function completedTask(id: string): SQL {
	const aliases = id === "explore.tools" ? [id, "website.embed"] : id === "appearance.clip-filters" ? [id, "appearance.filters"] : [id];
	const present = sql`(${sql.join(
		aliases.map((value) => sql`completed ? ${value}`),
		sql` OR `,
	)})`;
	// Match parseProgress's legacy source/filter migration without loading account state into telemetry.
	return id === "appearance.clip-filters" ? sql`(${present} OR (data->'overlaySourceVersion' IS DISTINCT FROM '2'::jsonb AND completed ? 'overlay.source'))` : present;
}
function skippedTask(id: string): SQL {
	const alias = id === "explore.tools" ? "website.embed" : id === "appearance.clip-filters" ? "appearance.filters" : id;
	return sql`((skipped ? ${id} OR skipped ? ${alias}) AND NOT ${completedTask(id)})`;
}

/** One database aggregate; no account IDs, resource IDs or raw guide state leave the query. */
export async function getUserTourHealthStats(db: Pick<QueryClient, "execute">, totalAccounts: number): Promise<UserTourStats> {
	const groups = [{ id: "overall", tasks: journeys.flatMap((journey) => journey.tasks.map((task) => task.id)) }, ...journeys.map((journey) => ({ id: journey.id, tasks: journey.tasks.map((task) => task.id) }))];
	const tasks = journeys.flatMap((journey) => journey.tasks.map((task) => ({ ...task, section: journey.id, key: task.id.replace(/[.-]/g, "_") })));
	const taskFields = tasks.flatMap((task) => [sql`count(*) FILTER (WHERE ${completedTask(task.id)}) AS ${sql.identifier(`${task.key}_completed`)}`, sql`count(*) FILTER (WHERE ${skippedTask(task.id)}) AS ${sql.identifier(`${task.key}_skipped`)}`]);
	const activity = groups[0].tasks.flatMap((id) => [completedTask(id), skippedTask(id)]);
	const fields = groups.flatMap(({ id, tasks }) => {
		const completed = tasks.map(completedTask);
		const skipped = tasks.map(skippedTask);
		const tally = (flags: SQL[]) =>
			sql`coalesce(sum(${sql.join(
				flags.map((flag) => sql`CASE WHEN ${flag} THEN 1 ELSE 0 END`),
				sql` + `,
			)}), 0)`;
		return [sql`count(*) FILTER (WHERE ${sql.join(completed, sql` AND `)}) AS ${sql.identifier(`${id}_completedAccounts`)}`, sql`count(*) FILTER (WHERE ${sql.join([...completed, ...skipped], sql` OR `)}) AS ${sql.identifier(`${id}_accountsWithProgress`)}`, sql`${tally(completed)} AS ${sql.identifier(`${id}_completedTasks`)}`, sql`${tally(skipped)} AS ${sql.identifier(`${id}_skippedTasks`)}`];
	});
	const result = await db.execute(sql`
		WITH parsed AS MATERIALIZED (
			SELECT CASE WHEN pg_input_is_valid(${userContentStatesTable.state}, 'jsonb') THEN ${userContentStatesTable.state}::jsonb ELSE NULL END AS data
			FROM ${userContentStatesTable} WHERE ${userContentStatesTable.contentKey} = ${guideContentKey}
		), valid AS (
			SELECT CASE WHEN data->'version' IN ('1'::jsonb, '2'::jsonb) AND jsonb_typeof(data->'completed') = 'array' THEN data ELSE NULL END AS data FROM parsed
		), progress AS (
			SELECT data, coalesce(data->'completed', '[]'::jsonb) AS completed,
				CASE WHEN jsonb_typeof(data->'skipped') = 'array' THEN data->'skipped' ELSE '[]'::jsonb END AS skipped FROM valid
		)
		SELECT count(*) AS tracked, count(*) FILTER (WHERE data IS NULL) AS invalid,
			count(*) FILTER (WHERE (${sql.join(activity, sql` OR `)}) OR data->'active'->>'task' IN (${sql.join(
				tasks.map((task) => sql`${task.id}`),
				sql`, `,
			)})) AS started,
			count(*) FILTER (WHERE data->>'copiedOverlayId' ~ '^[a-zA-Z0-9_-]{1,128}$' AND data->>'copiedOverlayId' = data->>'overlayId') AS copied,
			${sql.join([...fields, ...taskFields], sql`, `)} FROM progress
	`);
	const row = result.rows[0];
	const trackedAccounts = Number(row.tracked);
	const stats = (id: string, tasksPerAccount: number) => {
		const completedAccounts = Number(row[`${id}_completedAccounts`]);
		const completedTasks = Number(row[`${id}_completedTasks`]);
		return { tasksPerAccount, accountsWithProgress: Number(row[`${id}_accountsWithProgress`]), completedAccounts, completedTasks, skippedTasks: Number(row[`${id}_skippedTasks`]), completionRate: trackedAccounts ? completedAccounts / trackedAccounts : 0, averageProgress: trackedAccounts ? completedTasks / (trackedAccounts * tasksPerAccount) : 0 };
	};
	const validAccounts = trackedAccounts - Number(row.invalid);
	const startedAccounts = Number(row.started);
	const requiredCompletedAccounts = Number(row.overlay_completedAccounts);
	return {
		...stats("overall", groups[0].tasks.length),
		startedAccounts,
		inProgressAccounts: Math.max(0, startedAccounts - requiredCompletedAccounts),
		overlayLinkCopiedAccounts: Number(row.copied),
		tasks: Object.fromEntries(
			tasks.map((task) => {
				const completedAccounts = Number(row[`${task.key}_completed`]);
				const skippedAccounts = Number(row[`${task.key}_skipped`]);
				return [task.key, { title: task.title, section: task.section, completedAccounts, skippedAccounts, pendingAccounts: validAccounts - completedAccounts - skippedAccounts, completionRate: validAccounts ? completedAccounts / validAccounts : 0 }];
			}),
		),
		trackedAccounts,
		untrackedAccounts: Math.max(0, totalAccounts - trackedAccounts),
		invalidProgressAccounts: Number(row.invalid),
		sections: Object.fromEntries(journeys.map((journey) => [journey.id, { title: journey.title, ...stats(journey.id, journey.tasks.length) }])),
	};
}
