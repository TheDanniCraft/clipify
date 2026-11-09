"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { DropZone } from "@heroui-pro/react";
import { EventText } from "./EventFields";
import { eventUploadMimes, MAX_EVENT_UPLOAD_BYTES } from "@lib/eventUploads";
export default function EventUploadForm({ eventId, categoryId, kind, onSubmitted, team = false }: { eventId: string; categoryId: string; kind: "image" | "audio" | "video"; onSubmitted: () => void; team?: boolean }) {
	const [file, setFile] = useState<File | null>(null),
		[title, setTitle] = useState(""),
		[busy, setBusy] = useState(false),
		[error, setError] = useState(""),
		[message, setMessage] = useState("");
	const upload = useRef<AbortController | null>(null);
	useEffect(() => () => upload.current?.abort(), []);
	function select(incoming: File | undefined) {
		if (busy || !incoming) return;
		setError("");
		setMessage("");
		if (!incoming.type.startsWith(`${kind}/`) || !eventUploadMimes.some((mime) => mime === incoming.type) || incoming.size < 1 || incoming.size > MAX_EVENT_UPLOAD_BYTES) {
			setError(`Choose a supported ${kind} up to 100 MB.`);
			return;
		}
		setFile(incoming);
		if (!title) setTitle(incoming.name.replace(/\.[^.]+$/, ""));
	}
	async function submit() {
		if (!file || busy) return;
		if (!title.trim()) {
			setError("Give your proposal a name.");
			return;
		}
		setBusy(true);
		setError("");
		setMessage("");
		upload.current = new AbortController();
		try {
			const response = await fetch(`/api/events/${eventId}/upload?category=${encodeURIComponent(categoryId)}${team ? "&mode=team" : ""}`, { method: "POST", headers: { "Content-Type": file.type, "X-Upload-Size": String(file.size), "X-Upload-Title": encodeURIComponent(title) }, body: file, signal: upload.current.signal });
			const result = (await response.json()) as { ok?: boolean; code?: string };
			if (!response.ok || !result.ok) {
				setError(result.code === "PHASE_CLOSED" ? "Nominations have closed. Your file was not submitted." : result.code === "LIMIT_REACHED" ? "You have reached this category’s limit or another upload is still running. Withdraw an earlier proposal or try again shortly." : "Your file could not be submitted. Your selection is preserved; please try again.");
				return;
			}
			setFile(null);
			setTitle("");
			setMessage(team ? "Candidate added." : "Your proposal was submitted.");
			onSubmitted();
		} catch (exception) {
			setError(exception instanceof Error && exception.name === "AbortError" ? "Upload cancelled. Your selection is preserved." : "Your file could not be submitted. Your selection is preserved; please try again.");
		} finally {
			setBusy(false);
			upload.current = null;
		}
	}
	return (
		<div className='space-y-4'>
			<EventText label='Proposal name' value={title} onChange={setTitle} />
			<DropZone>
				<DropZone.Area
					isDisabled={busy}
					onDrop={async (event) => {
						const item = event.items.find((item) => item.kind === "file");
						if (item?.kind === "file") select(await item.getFile());
					}}
				>
					<DropZone.Icon />
					<DropZone.Label>Drop your {kind} here</DropZone.Label>
					<DropZone.Description>Choose one file up to 100 MB.</DropZone.Description>
					<DropZone.Trigger isDisabled={busy}>Choose {kind}</DropZone.Trigger>
				</DropZone.Area>
				<DropZone.Input accept={eventUploadMimes.filter((mime) => mime.startsWith(`${kind}/`)).join(",")} onSelect={(files) => select(files[0])} />
				{file ? (
					<DropZone.FileList>
						<DropZone.FileItem status={busy ? "uploading" : error ? "failed" : undefined}>
							<DropZone.FileInfo>
								<DropZone.FileName>{file.name}</DropZone.FileName>
								<DropZone.FileMeta>
									{new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(file.size / 1048576)} MB{busy ? " — Uploading…" : ""}
								</DropZone.FileMeta>
							</DropZone.FileInfo>
							<DropZone.FileRemoveTrigger aria-label='Remove selected file' isDisabled={busy} onPress={() => setFile(null)} />
						</DropZone.FileItem>
					</DropZone.FileList>
				) : null}
			</DropZone>
			{error ? (
				<p role='alert' className='text-sm text-danger'>
					{error}
				</p>
			) : null}
			{message ? (
				<p role='status' className='text-sm text-success'>
					{message}
				</p>
			) : null}
			<div className='flex gap-3'>
				<Button isPending={busy} isDisabled={!file || busy} onPress={() => void submit()}>
					{team ? "Add candidate" : "Submit proposal"}
				</Button>
				{busy ? (
					<Button variant='secondary' onPress={() => upload.current?.abort()}>
						Cancel upload
					</Button>
				) : null}
			</div>
		</div>
	);
}
