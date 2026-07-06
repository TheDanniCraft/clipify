"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@heroui/react";
import { IconChecks, IconClipboard } from "@tabler/icons-react";

type CodeSnippetProps = {
	children: string;
	symbol?: ReactNode;
	size?: "sm" | "md" | "lg";
	className?: string;
	preClassName?: string;
};

const sizeClasses = {
	sm: "px-2 py-1 text-xs",
	md: "px-3 py-1.5 text-sm",
	lg: "px-4 py-2 text-base",
};

export default function CodeSnippet({ children, symbol = "$", size = "md", className, preClassName }: CodeSnippetProps) {
	const [copied, setCopied] = useState(false);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(children);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	};

	return (
		<div className={["flex items-center gap-2 rounded-lg bg-surface-secondary", sizeClasses[size], className].filter(Boolean).join(" ")}>
			<pre className={["m-0 min-w-0 flex-1 font-mono", preClassName].filter(Boolean).join(" ")}>
				{symbol ? <span className='text-muted'>{symbol} </span> : null}
				<code>{children}</code>
			</pre>
			<Button isIconOnly size='sm' type='button' variant='ghost' className='shrink-0' onPress={copy} aria-label={copied ? "Copied" : "Copy to clipboard"}>
				{copied ? <IconChecks className='size-4' /> : <IconClipboard className='size-4' />}
			</Button>
		</div>
	);
}
