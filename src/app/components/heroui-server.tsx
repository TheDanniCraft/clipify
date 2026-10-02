import type { ComponentProps } from "react";
import { AlertContent, AlertDescription, AlertIndicator, AlertRoot, AlertTitle, CardContent, CardDescription, CardFooter, CardHeader, CardRoot, CardTitle, ProgressBarFill, ProgressBarOutput, ProgressBarRoot, ProgressBarTrack } from "./heroui-client";

// Client component references lose their static compound members when they
// cross the React Server Component boundary. These server-side facades retain
// HeroUI's compound API while rendering the named client exports directly.
export const Alert = Object.assign((props: ComponentProps<typeof AlertRoot>) => <AlertRoot {...props} />, {
	Indicator: AlertIndicator,
	Content: AlertContent,
	Title: AlertTitle,
	Description: AlertDescription,
});

export const Card = Object.assign((props: ComponentProps<typeof CardRoot>) => <CardRoot {...props} />, {
	Header: CardHeader,
	Title: CardTitle,
	Description: CardDescription,
	Content: CardContent,
	Footer: CardFooter,
});

export const ProgressBar = Object.assign((props: ComponentProps<typeof ProgressBarRoot>) => <ProgressBarRoot {...props} />, {
	Output: ProgressBarOutput,
	Track: ProgressBarTrack,
	Fill: ProgressBarFill,
});
