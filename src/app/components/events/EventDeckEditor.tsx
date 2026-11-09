"use client";
import { Button, Dropdown, Label, TextArea, TextField } from "@heroui/react";
import { useState, type ReactNode } from "react";
import type { EventConfiguration, EventCategory } from "@lib/eventConfiguration";
import { EventText, EventSelect, EventNumber } from "./EventFields";
type Slide = EventConfiguration["slides"][number];
export default function EventDeckEditor({ value, categories, onChange, readOnly = false, preview }: { value: Slide[]; categories: EventCategory[]; onChange: (value: Slide[]) => void; readOnly?: boolean; preview?: (slideId: string | undefined) => ReactNode }) {
	const [selected, setSelected] = useState<string>();
	const active = value.find((s) => s.id === selected) ?? value[0];
	function patch(change: Partial<Slide>) {
		if (active) onChange(value.map((s) => (s.id === active.id ? { ...s, ...change } : s)));
	}
	function add(type: Slide["type"]) {
		const slide: Slide = { id: crypto.randomUUID(), type, title: type === "welcome" ? "Welcome" : type === "closing" ? "Thank you!" : "", text: "", statistics: [], ...(type === "category" ? { categoryId: categories[0]?.id } : {}) };
		const next = [...value];
		const closing = next.findIndex((item) => item.type === "closing");
		next.splice(type === "welcome" ? 0 : type === "closing" || closing < 0 ? next.length : closing, 0, slide);
		onChange(next);
		setSelected(slide.id);
	}
	return (
		<div className='space-y-5'>
			{!readOnly ? (
				<Dropdown>
					<Button variant='secondary'>Add slide</Button>
					<Dropdown.Popover>
						<Dropdown.Menu aria-label='Slide types' onAction={(key) => add(String(key) as Slide["type"])}>
							{(["welcome", "text", "statistics", "category", "closing"] as const).map((type) => (
								<Dropdown.Item key={type} id={type} textValue={`Add ${type} slide`}>
									<Label>Add {type} slide</Label>
								</Dropdown.Item>
							))}
						</Dropdown.Menu>
					</Dropdown.Popover>
				</Dropdown>
			) : null}
			<div className='grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]'>
				<ol className='flex min-w-0 gap-3 overflow-x-auto pb-2 lg:max-h-[75vh] lg:flex-col lg:overflow-y-auto'>
					{value.map((slide, index) => (
						<li key={slide.id} className='w-44 shrink-0 rounded-xl bg-default/40 p-2 lg:w-full'>
							<Button variant={active?.id === slide.id ? "secondary" : "tertiary"} className='h-auto w-full flex-col items-stretch whitespace-normal p-0 text-left' onPress={() => setSelected(slide.id)}>
								<span className='flex aspect-video w-full items-center justify-center rounded-lg bg-background p-3 text-center text-sm'>
									<span className='line-clamp-3 min-w-0 break-words'>
										{index + 1}. {slide.title || (slide.type === "category" ? categories.find((category) => category.id === slide.categoryId)?.title || "Category" : slide.type)}
									</span>
								</span>
							</Button>
							{!readOnly ? (
								<div className='mt-2 flex gap-2'>
									<Button
										size='sm'
										variant='tertiary'
										aria-label={`Move slide ${index + 1} up`}
										isDisabled={index === 0}
										onPress={() => {
											const next = [...value];
											[next[index - 1], next[index]] = [next[index], next[index - 1]];
											onChange(next);
										}}
									>
										↑
									</Button>
									<Button
										size='sm'
										variant='tertiary'
										aria-label={`Move slide ${index + 1} down`}
										isDisabled={index === value.length - 1}
										onPress={() => {
											const next = [...value];
											[next[index + 1], next[index]] = [next[index], next[index + 1]];
											onChange(next);
										}}
									>
										↓
									</Button>
									<Button
										size='sm'
										variant='tertiary'
										onPress={() => {
											onChange(value.filter((s) => s.id !== slide.id));
											setSelected(undefined);
										}}
									>
										Remove
									</Button>
								</div>
							) : null}
						</li>
					))}
				</ol>
				<div className='min-w-0 space-y-5'>
					{preview?.(active?.id)}
					{active ? (
						<fieldset disabled={readOnly} className='min-w-0 space-y-4'>
							<EventText label='Slide title' value={active.title} onChange={(title) => patch({ title })} />
							{active.type === "category" ? <EventSelect label='Category' value={active.categoryId ?? ""} options={categories.map((c) => ({ id: c.id, label: c.title }))} onChange={(categoryId) => patch({ categoryId })} /> : null}
							{active.type === "text" || active.type === "welcome" || active.type === "closing" ? (
								<TextField>
									<Label>Slide text</Label>
									<TextArea variant='secondary' value={active.text} onChange={(e) => patch({ text: e.target.value })} />
								</TextField>
							) : null}
							{active.type === "statistics" ? (
								<div className='space-y-4'>
									{active.statistics.map((stat, index) => (
										<div key={index} className='space-y-3 rounded-xl bg-default/40 p-4'>
											<EventText label={`Statistic ${index + 1} label`} value={stat.label} onChange={(label) => patch({ statistics: active.statistics.map((s, i) => (i === index ? { ...s, label } : s)) })} />
											<EventSelect
												label={`Statistic ${index + 1} source`}
												value={stat.source}
												options={[
													{ id: "manual", label: "Custom number" },
													{ id: "submissions", label: "Submissions" },
													{ id: "categories", label: "Categories" },
													{ id: "nominees", label: "Nominees" },
													{ id: "voters", label: "Voters" },
													{ id: "clips", label: "Clipify clip library" },
												]}
												onChange={(source) => patch({ statistics: active.statistics.map((s, i) => (i === index ? { ...s, source: source as typeof stat.source } : s)) })}
											/>
											{stat.source === "manual" ? <EventNumber label={`Statistic ${index + 1} value`} value={stat.value ?? 0} max={1000000000000} onChange={(value) => patch({ statistics: active.statistics.map((s, i) => (i === index ? { ...s, value } : s)) })} /> : null}
											<Button variant='tertiary' onPress={() => patch({ statistics: active.statistics.filter((_, i) => i !== index) })}>
												Remove statistic
											</Button>
										</div>
									))}
									<Button variant='secondary' onPress={() => patch({ statistics: [...active.statistics, { label: "New statistic", source: "manual", value: 0 }] })}>
										Add statistic
									</Button>
								</div>
							) : null}
						</fieldset>
					) : (
						<p className='text-sm text-muted'>Select a slide to edit its content.</p>
					)}
				</div>
			</div>
		</div>
	);
}
