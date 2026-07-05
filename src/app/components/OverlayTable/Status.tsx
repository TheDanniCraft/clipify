import React, { forwardRef, memo } from "react";
import { cn } from "@heroui/react";

import { StatusOptions } from "@types";
import { statusColorMap } from "./data";

export interface StatusProps extends React.HTMLAttributes<HTMLDivElement> {
	className?: string;
	status: StatusOptions;
}

export const Status = memo(
	forwardRef<HTMLDivElement, StatusProps>((props, forwardedRef) => {
		const { className, status } = props;
		const statusColor = statusColorMap[status];

		return (
			<div ref={forwardedRef} className={cn("flex w-fit items-center gap-[2px] rounded-lg bg-surface-secondary px-2 py-1", className)}>
				{statusColor}
				<span className='px-1 text-foreground'>{status}</span>
			</div>
		);
	})
);

Status.displayName = "Status";
