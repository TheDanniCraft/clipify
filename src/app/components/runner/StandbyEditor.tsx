"use client";
import { Label, TextArea, TextField, Switch, Button } from "@heroui/react";
type Props = { disabled: boolean; backgroundColor: string; message: string; showNextBroadcastTime: boolean; hasLogo: boolean; hasBackground: boolean; onRemoveLogo: () => void; onRemoveBackground: () => void; onShowNextBroadcastTimeChange: (value: boolean) => void; onBackgroundColorChange: (value: string) => void; onMessageChange: (value: string) => void; onUpload: (file: File | undefined, kind: "background" | "logo") => void };
export default function StandbyEditor({ disabled, backgroundColor, message, onBackgroundColorChange, onMessageChange, onUpload, showNextBroadcastTime, onShowNextBroadcastTimeChange, hasLogo, hasBackground, onRemoveLogo, onRemoveBackground }: Props) {
	return (
		<div className='grid gap-4 sm:grid-cols-2'>
			<label className='flex flex-col gap-2 text-sm'>
				Standby logo
				<input
					aria-label='Standby logo'
					type='file'
					accept='image/png,image/jpeg,image/webp'
					disabled={disabled}
					onChange={(event) => {
						onUpload(event.target.files?.[0], "logo");
						event.target.value = "";
					}}
				/>
				<span className='text-xs text-muted'>PNG, JPEG or WebP, up to 2 MiB.</span>
			</label>
			<label className='flex flex-col gap-2 text-sm'>
				Standby background image
				<input
					aria-label='Standby background image'
					type='file'
					accept='image/png,image/jpeg,image/webp'
					disabled={disabled}
					onChange={(event) => {
						onUpload(event.target.files?.[0], "background");
						event.target.value = "";
					}}
				/>
				<span className='text-xs text-muted'>PNG, JPEG or WebP, up to 2 MiB.</span>
			</label>
			{(hasLogo || hasBackground) && (
				<div className='flex flex-wrap gap-2 sm:col-span-2'>
					{hasLogo && (
						<Button variant='secondary' size='sm' isDisabled={disabled} onPress={onRemoveLogo}>
							Remove logo
						</Button>
					)}
					{hasBackground && (
						<Button variant='secondary' size='sm' isDisabled={disabled} onPress={onRemoveBackground}>
							Remove background image
						</Button>
					)}
				</div>
			)}
			<label className='flex flex-col gap-2 text-sm'>
				Standby background color
				<input aria-label='Standby background color' type='color' value={backgroundColor} onChange={(event) => onBackgroundColorChange(event.target.value)} disabled={disabled} className='h-10 w-20 cursor-pointer rounded-md border border-default p-1' />
			</label>
			<TextField className='sm:col-span-2'>
				<Label>Standby message</Label>
				<TextArea aria-label='Standby message' maxLength={160} rows={3} value={message} disabled={disabled} onChange={(event) => onMessageChange(event.target.value)} />
				<span className='text-xs text-muted'>{message.length}/160 characters</span>
			</TextField>
			<Switch className='sm:col-span-2' aria-label='Show next broadcast time' isSelected={showNextBroadcastTime} onChange={onShowNextBroadcastTimeChange} isDisabled={disabled}>
				<Switch.Content>
					<Switch.Control>
						<Switch.Thumb />
					</Switch.Control>
					<Label>Show next broadcast time</Label>
				</Switch.Content>
			</Switch>
			<p className='text-xs text-muted sm:col-span-2'>Shows the next scheduled broadcast in its saved timezone. Paused schedules stay hidden.</p>
		</div>
	);
}
