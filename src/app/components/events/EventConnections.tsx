"use client";
import { useEffect, useState } from "react";
import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import ControlledModal from "@components/controlledModal";
import { listEventConnectionsAction, beginEventGoogleConnectionAction, saveEventS3ConnectionAction } from "@actions/events";
import { EventSelect, EventText } from "./EventFields";
type Connection = { id: string; provider: "s3" | "drive" | "youtube"; identityName: string; connected: boolean };
export default function EventConnections({ creatorId, eventId, value, onChange, readOnly = false, beforeConnect, status }: { creatorId: string; eventId: string; value: string | null; onChange: (id: string | null) => void; readOnly?: boolean; beforeConnect?: () => Promise<boolean>; status?: "connected" | "retry" }) {
	const [connections, setConnections] = useState<Connection[]>([]),
		[loading, setLoading] = useState(true),
		[attempt, setAttempt] = useState(0),
		[busy, setBusy] = useState(false),
		[error, setError] = useState(""),
		[open, setOpen] = useState(false);
	const [credentials, setCredentials] = useState({ endpoint: "", region: "auto", bucket: "", accessKeyId: "", secretAccessKey: "", prefix: "clipify-events" });
	const update = (patch: Partial<typeof credentials>) => setCredentials((current) => ({ ...current, ...patch }));
	useEffect(() => {
		let active = true;
		void listEventConnectionsAction(creatorId)
			.then((result) => {
				if (!active) return;
				if (result.ok) setConnections(result.connections);
				else setError("Connections could not be loaded. Please retry.");
			})
			.catch(() => {
				if (active) setError("Connections could not be loaded. Please retry.");
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, [creatorId, attempt]);
	async function google(provider: "drive" | "youtube") {
		setBusy(true);
		setError("");
		try {
			if (beforeConnect && !(await beforeConnect())) {
				setError("Save your event changes before connecting Google.");
				return;
			}
			const result = await beginEventGoogleConnectionAction(creatorId, provider, eventId);
			if (result.ok && result.url) window.location.assign(result.url);
			else setError("Google could not be connected. Please try again.");
		} catch {
			setError("Google could not be connected. Please try again.");
		} finally {
			setBusy(false);
		}
	}
	async function s3() {
		setBusy(true);
		setError("");
		try {
			const result = await saveEventS3ConnectionAction(creatorId, credentials);
			if (!result.ok) {
				setError(result.code === "CONFLICT" ? "This bucket already contains event files. Keep the same endpoint, region and bucket when updating its credentials." : "Check your S3 endpoint, credentials and bucket permissions, then try again.");
				return;
			}
			setConnections((current) => [...current.filter((c) => c.provider !== "s3"), result.connection]);
			if (!readOnly) onChange(result.connection.id);
			setOpen(false);
			setCredentials((current) => ({ ...current, accessKeyId: "", secretAccessKey: "" }));
		} catch {
			setError("Check your S3 endpoint, credentials and bucket permissions, then try again.");
		} finally {
			setBusy(false);
		}
	}
	const storage = connections.filter((c) => c.connected && c.provider !== "youtube");
	return (
		<div className='space-y-5'>
			<div>
				<h2 className='font-semibold'>Connected accounts</h2>
				<p className='mt-1 text-sm text-muted'>Choose where uploaded files are stored. Google asks for access only to files created by Clipify; YouTube is connected separately.</p>
			</div>
			{status === "connected" ? (
				<p role='status' className='text-sm text-success'>
					Google account connected. Your available accounts are listed below.
				</p>
			) : status === "retry" ? (
				<p role='alert' className='text-sm text-danger'>
					Google was not connected. Try again and grant the requested access.
				</p>
			) : null}
			{error && !open ? (
				<div className='flex flex-wrap items-center gap-3'>
					<p role='alert' className='text-sm text-danger'>
						{error}
					</p>
					<Button
						size='sm'
						variant='secondary'
						isDisabled={busy || loading}
						onPress={() => {
							setLoading(true);
							setError("");
							setAttempt((value) => value + 1);
						}}
					>
						Retry connections
					</Button>
				</div>
			) : null}
			{loading ? (
				<p role='status' className='text-sm text-muted'>
					Loading connections…
				</p>
			) : null}
			<div className='flex flex-wrap gap-3'>
				{(["drive", "youtube"] as const).map((provider) => (
					<Button key={provider} variant='secondary' isDisabled={busy || loading} onPress={() => void google(provider)}>
						{connections.some((c) => c.provider === provider && c.connected) ? "Reconnect" : "Connect"} {provider === "drive" ? "Google Drive" : "YouTube"}
					</Button>
				))}
				<Button
					variant='secondary'
					isDisabled={busy || loading}
					onPress={() => {
						setError("");
						setOpen(true);
					}}
				>
					Connect S3
				</Button>
			</div>
			{connections
				.filter((c) => c.connected)
				.map((c) => (
					<p key={c.id} className='text-sm'>
						{c.provider === "youtube" ? "YouTube" : c.provider === "drive" ? "Google Drive" : "S3"}: {c.identityName}
					</p>
				))}
			{!readOnly ? <EventSelect label='Upload storage' value={value ?? ""} onChange={(id) => onChange(id || null)} options={[{ id: "", label: "Select connected storage" }, ...storage.map((c) => ({ id: c.id, label: `${c.provider === "drive" ? "Google Drive" : "S3"}: ${c.identityName}` }))]} /> : null}
			{!storage.length && !loading ? <p className='text-sm text-muted'>Connect storage above before publishing categories that accept uploads.</p> : null}
			<ControlledModal isOpen={open} onOpenChange={setOpen} ariaLabel='Connect S3' size='lg'>
				<Modal.Header>
					<Modal.Heading>Connect S3</Modal.Heading>
				</Modal.Header>
				<Modal.Body className='space-y-4'>
					{error ? (
						<p role='alert' className='text-sm text-danger'>
							{error}
						</p>
					) : null}
					<EventText label='S3 endpoint' value={credentials.endpoint} onChange={(endpoint) => update({ endpoint })} />
					<div className='grid gap-4 sm:grid-cols-2'>
						<EventText label='Region' value={credentials.region} onChange={(region) => update({ region })} />
						<EventText label='Bucket' value={credentials.bucket} onChange={(bucket) => update({ bucket })} />
					</div>
					<EventText label='Access key ID' value={credentials.accessKeyId} onChange={(accessKeyId) => update({ accessKeyId })} />
					<TextField>
						<Label>Secret access key</Label>
						<Input aria-label='Secret access key' type='password' autoComplete='off' variant='secondary' value={credentials.secretAccessKey} onChange={(e) => update({ secretAccessKey: e.target.value })} />
					</TextField>
					<EventText label='Folder prefix' value={credentials.prefix} onChange={(prefix) => update({ prefix })} />
					<p className='text-sm text-muted'>The key needs read, write and delete access inside this folder.</p>
				</Modal.Body>
				<Modal.Footer>
					<Button variant='secondary' isDisabled={busy} onPress={() => setOpen(false)}>
						Cancel
					</Button>
					<Button isPending={busy} onPress={() => void s3()}>
						Save S3 connection
					</Button>
				</Modal.Footer>
			</ControlledModal>
		</div>
	);
}
