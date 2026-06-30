import { toast } from "@heroui/react";
import type { ReactNode } from "react";

type ToastColor = "default" | "accent" | "success" | "warning" | "danger";

type NotifyOptions = {
	title: ReactNode;
	description?: ReactNode;
	color?: ToastColor;
	timeout?: number;
};

export function notify({ title, description, color = "default", timeout }: NotifyOptions) {
	const options = { description, timeout };

	switch (color) {
		case "success":
			return toast.success(title, options);
		case "warning":
			return toast.warning(title, options);
		case "danger":
			return toast.danger(title, options);
		case "accent":
			return toast.info(title, options);
		default:
			return toast(title, options);
	}
}
