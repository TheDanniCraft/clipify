import { Button, Tooltip, cn } from "@heroui/react";

import React, { forwardRef, memo, useMemo } from "react";
import { IconChecks, IconClipboard } from "@tabler/icons-react";

export interface CopyTextProps extends React.HTMLAttributes<HTMLDivElement> {
	className?: string;
	textClassName?: string;
	copyText?: string;
	children: string;
}

export const CopyText = memo(
	forwardRef<HTMLDivElement, CopyTextProps>((props, forwardedRef) => {
		const { className, textClassName, children, copyText = "Copy" } = props;
		const [copied, setCopied] = React.useState(false);
		const [copyTimeout, setCopyTimeout] = React.useState<ReturnType<typeof setTimeout> | null>(null);
		const onClearTimeout = () => {
			if (copyTimeout) {
				clearTimeout(copyTimeout);
			}
		};

		const handleClick = () => {
			onClearTimeout();
			navigator.clipboard.writeText(children);
			setCopied(true);

			setCopyTimeout(
				setTimeout(() => {
					setCopied(false);
				}, 3000)
			);
		};

		const content = useMemo(() => (copied ? "Copied" : copyText), [copied, copyText]);

		return (
			<div ref={forwardedRef} className={cn("flex items-center gap-3 text-muted", className)}>
				<span className={textClassName}>{children}</span>
			<Tooltip delay={0}>
				<Tooltip.Trigger><Button isIconOnly className='h-7 w-7 min-w-7 text-muted' size='sm' variant='tertiary' onPress={handleClick} aria-label='Copy to clipboard'>
					{!copied && <IconClipboard className='h-[14px] w-[14px]' />}
					{copied && <IconChecks className='h-[14px] w-[14px]' />}
				</Button></Tooltip.Trigger>
				<Tooltip.Content className='text-foreground'>{content}</Tooltip.Content>
				</Tooltip>
			</div>
		);
	})
);

CopyText.displayName = "CopyText";
