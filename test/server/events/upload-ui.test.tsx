import { notify } from "@lib/toast";
jest.mock("@lib/toast", () => ({ notify: jest.fn() }));
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EventUploadForm from "@/app/components/events/EventUploadForm";
jest.mock(
	"@heroui-pro/react",
	() => {
		const React = jest.requireActual("react");
		const Part = ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children);
		return { DropZone: Object.assign(Part, { Area: Part, Icon: Part, Label: Part, Description: Part, Trigger: Part, Input: ({ onSelect }: { onSelect: (files: FileList) => void }) => React.createElement("input", { type: "file", "aria-label": "Choose image", onChange: (event: React.ChangeEvent<HTMLInputElement>) => onSelect(event.target.files!) }), FileList: Part, FileItem: Part, FileInfo: Part, FileName: Part, FileMeta: Part, FileRemoveTrigger: Part }) };
	},
	{ virtual: true },
);
it("preserves a selected image and title after upload failure", async () => {
	global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({ ok: false, code: "PROVIDER_UNAVAILABLE" }) })) as jest.Mock;
	render(<EventUploadForm eventId='event' categoryId='category' kind='image' onSubmitted={jest.fn()} />);
	fireEvent.change(screen.getByLabelText("Choose image"), { target: { files: [new File(["image"], "Lampe.png", { type: "image/png" })] } });
	fireEvent.change(screen.getByLabelText("Proposal name"), { target: { value: "Beste Lampe" } });
	fireEvent.click(screen.getByRole("button", { name: "Submit proposal" }));
	await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("Your file could not be submitted"), color: "danger" })));
	expect(screen.getByText("Lampe.png", { exact: true })).toBeInTheDocument();
	expect(screen.getByLabelText("Proposal name")).toHaveValue("Beste Lampe");
});

beforeEach(() => jest.mocked(notify).mockClear());
