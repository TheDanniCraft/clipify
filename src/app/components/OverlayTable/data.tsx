import { IconCircleFilled } from "@tabler/icons-react";
import { StatusOptions } from "@types";
import { JSX } from "react";

export const statusOptions = [
	{ name: "Active", uid: "active" },
	{ name: "Paused", uid: "paused" },
] as const;

export const statusColorMap: Record<StatusOptions, JSX.Element> = {
	active: <IconCircleFilled color='hsl(var(--heroui-success))' />,
	paused: <IconCircleFilled color='hsl(var(--heroui-danger))' />,
};

export type ColumnsKey = "accessType" | "id" | "name" | "status" | "actions";

export const INITIAL_VISIBLE_COLUMNS: ColumnsKey[] = ["accessType", "id", "name", "status", "actions"];

export const columns = [
	{ name: "", uid: "accessType", sortDirection: "ascending" },
	{ name: "Overlay ID", uid: "id" },
	{ name: "Name", uid: "name", sortDirection: "ascending" },
	{ name: "Status", uid: "status", info: "The overlay's current status" },
	{ name: "Actions", uid: "actions" },
];
