"use client";
import { useEffect, useState } from "react";
import { Button, ComboBox, Input, Label, ListBox, Select, Switch, TextArea, TextField } from "@heroui/react";
import ImageDropZone from "./ImageDropZone";
import { searchRunnerTwitchCategories, uploadRunnerScheduleThumbnail } from "@/app/actions/runner";
import type { StreamDetails } from "@/app/lib/runnerProviderDetails";
type Target = { id: string; name: string; provider?: string; connectionId?: string | null };
export default function BroadcastDetails({ ownerId, runnerId, targets, eventTitle, enabled, details, disabled, onEnabledChange, onChange, onBusyChange, onManage }: { ownerId: string; runnerId: string; targets: Target[]; eventTitle: string; enabled: boolean; details: StreamDetails[]; disabled: boolean; onEnabledChange: (value: boolean) => void; onChange: (details: StreamDetails[]) => void; onBusyChange: (busy: boolean) => void; onManage: () => void }) {
	const eligible = targets.filter((target) => target.connectionId && ["twitch", "youtube"].includes(target.provider ?? ""));
	const [selected, setSelected] = useState(eligible[0]?.id ?? "");
	const target = eligible.find((target) => target.id === selected) ?? eligible[0];
	const value = details.find((detail) => detail.destinationId === target?.id);
	const [error, setError] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [query, setQuery] = useState(value?.categoryName ?? "");
	const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
	const [searching, setSearching] = useState(false);
	const [categoryError, setCategoryError] = useState<string | null>(null);
	const [imageName, setImageName] = useState<string | null>(null);
	function change(patch: Partial<StreamDetails>) {
		if (!target) return;
		onChange([...details.filter((detail) => detail.destinationId !== target.id), { destinationId: target.id, ...value, ...patch }]);
	}

	useEffect(() => {
		let current = true;
		if (!target?.connectionId || target.provider !== "twitch" || query.trim().length < 2 || disabled) {
			return;
		}
		const timer = setTimeout(() => {
			setSearching(true);
			void searchRunnerTwitchCategories({ ownerId, connectionId: target.connectionId!, query })
				.then((result) => {
					if (!current) return;
					if (result.success) {
						setCategories(result.categories);
						setCategoryError(null);
					} else setCategoryError(result.error);
				})
				.catch(() => {
					if (current) setCategoryError("Could not load categories. Please try again.");
				})
				.finally(() => {
					if (current) setSearching(false);
				});
		}, 350);
		return () => {
			current = false;
			clearTimeout(timer);
		};
	}, [ownerId, target?.connectionId, target?.provider, query, disabled]);
	async function upload(file: File | undefined) {
		if (!file || !target) return;
		setError(null);
		setUploading(true);
		onBusyChange(true);
		try {
			const form = new FormData();
			form.set("ownerId", ownerId);
			form.set("runnerId", runnerId);
			form.set("file", file);
			const result = await uploadRunnerScheduleThumbnail(form);
			if (result.success) {
				change({ thumbnailAssetId: result.asset.id });
				setImageName(file.name);
			} else setError(result.error);
		} catch {
			setError("Could not upload the thumbnail. Please try again.");
		} finally {
			setUploading(false);
			onBusyChange(false);
		}
	}
	return (
		<div className='space-y-5'>
			<Switch
				isSelected={enabled}
				onChange={(value) => {
					onEnabledChange(value);
					if (value) onChange(eligible.map((target) => details.find((detail) => detail.destinationId === target.id) ?? { destinationId: target.id }));
				}}
				isDisabled={disabled || !eligible.length}
			>
				<Switch.Content>
					<Switch.Control>
						<Switch.Thumb />
					</Switch.Control>
					<Label>Set stream details</Label>
				</Switch.Content>
			</Switch>
			{!eligible.length && (
				<div className='space-y-3'>
					<p className='text-sm text-muted'>Connect a Twitch or YouTube channel to set its stream details.</p>
					<Button variant='secondary' isDisabled={disabled} onPress={onManage}>
						Manage destinations
					</Button>
				</div>
			)}
			{enabled && target && (
				<>
					<Select
						variant='secondary'
						value={target.id}
						onChange={(key) => {
							setSelected(String(key));
							setQuery(details.find((detail) => detail.destinationId === String(key))?.categoryName ?? "");
							setCategories([]);
							setCategoryError(null);
							setImageName(null);
						}}
						isDisabled={disabled || uploading}
					>
						<Label>Destination</Label>
						<Select.Trigger>
							<Select.Value />
							<Select.Indicator />
						</Select.Trigger>
						<Select.Popover>
							<ListBox>
								{eligible.map((target) => (
									<ListBox.Item id={target.id} key={target.id} textValue={target.name}>
										{target.name}
									</ListBox.Item>
								))}
							</ListBox>
						</Select.Popover>
					</Select>
					<TextField value={value?.title ?? ""} onChange={(title) => change({ title })} isReadOnly={disabled || uploading}>
						<Label>Stream title</Label>
						<Input variant='secondary' maxLength={100} placeholder={eventTitle || "Use event title"} />
						<p className='text-xs text-muted'>Uses the event title unless you enter another title.</p>
					</TextField>
					{target.provider === "twitch" ? (
						<div className='space-y-2'>
							<ComboBox
								variant='secondary'
								inputValue={query}
								onInputChange={(value) => {
									setQuery(value);
									setSearching(false);
								}}
								value={value?.categoryId ?? null}
								onChange={(key) => {
									const category = categories.find((row) => row.id === key);
									change({ categoryId: key ? String(key) : undefined, categoryName: category?.name });
									if (category) setQuery(category.name);
								}}
								isDisabled={disabled}
								allowsEmptyCollection
							>
								<Label>Category</Label>
								<ComboBox.InputGroup>
									<Input variant='secondary' placeholder={value?.categoryId ? "Category selected. Search to change." : "Keep current category"} />
									<ComboBox.Trigger />
								</ComboBox.InputGroup>
								<ComboBox.Popover>
									<ListBox items={categories} renderEmptyState={() => (searching ? "Searching categories…" : "Type at least two characters to search.")}>
										{(item) => (
											<ListBox.Item id={item.id} textValue={item.name}>
												{item.name}
											</ListBox.Item>
										)}
									</ListBox>
								</ComboBox.Popover>
							</ComboBox>
							{value?.categoryId && !disabled && (
								<Button
									variant='tertiary'
									size='sm'
									onPress={() => {
										change({ categoryId: undefined, categoryName: undefined });
										setQuery("");
									}}
								>
									Keep current category
								</Button>
							)}
							{categoryError && (
								<p role='alert' className='text-sm text-danger'>
									{categoryError}
								</p>
							)}
						</div>
					) : (
						<>
							<TextField value={value?.description ?? ""} onChange={(description) => change({ description })} isReadOnly={disabled || uploading}>
								<Label>Description</Label>
								<TextArea variant='secondary' maxLength={5000} rows={3} placeholder='Keep current description' />
							</TextField>
							<div className='space-y-2'>
								<Label>Thumbnail</Label>
								<ImageDropZone
									label={uploading ? "Uploading thumbnail…" : (imageName ?? (value?.thumbnailAssetId ? "Replace thumbnail" : "Upload a thumbnail"))}
									disabled={disabled || uploading}
									onSelect={(file) => {
										void upload(file);
									}}
								/>
								{value?.thumbnailAssetId && !disabled && (
									<Button
										variant='secondary'
										size='sm'
										onPress={() => {
											change({ thumbnailAssetId: undefined });
											setImageName(null);
										}}
									>
										Keep current thumbnail
									</Button>
								)}
							</div>
						</>
					)}
				</>
			)}
			{error && (
				<p role='alert' className='text-sm text-danger'>
					{error}
				</p>
			)}
		</div>
	);
}
