import { Button, Link } from "./email-links";
import { EMAIL_SUPPORT_ADDRESS, EMAIL_SUPPORT_URL, EMAIL_HELP_CENTER_URL } from "./formatting";
import { Body, Column, Container, Head, Heading, Hr, Html, Img, Preview, Row, Section, Text, render, toPlainText } from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";
import { resolveBaseUrl } from "@/app/lib/baseUrl";

/** sRGB equivalent of --accent in src/app/themes/clipify.css; inline colors work in email clients. */
export const EMAIL_BRAND_ACCENT = "#5f06f5";

export interface BrandedEmailContent {
	subject: string;
	preview?: string;
	title?: string;
	receivingReason?: string;
	/** Trusted, server-authored React Email components; never user-supplied markup. */
	children?: ReactNode;
	paragraphs?: ReactNode[];
	code?: string;
	action?: { label: string; url: string };
}

const darkStyles = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
.email-background, .email-background > table > tbody > tr > td { background-color: #111116 !important; }
.email-card { background-color: #1c1c24 !important; border-color: #363641 !important; border-top-color: #a78bfa !important; }
.email-title { color: #f5f3ff !important; }
.email-copy { color: #dddce6 !important; }
.email-muted { color: #b7b5c6 !important; }
.email-link { color: #c4b5fd !important; }
.email-rule { border-color: #363641 !important; }
.email-code { background-color: #302344 !important; border-color: #6d5298 !important; color: #e9d5ff !important; }
.email-notice { background-color: #262632 !important; color: #eeeaf7 !important; }
.email-error { border-color: #f31260 !important; }
.email-warning { border-color: #f5a524 !important; }
.email-icon-error { background-color: #f31260 !important; }
.email-icon-warning { background-color: #f5a524 !important; }
}
`;

/** sRGB equivalents of the app theme's HeroUI semantic colors. */
const noticeTypes = {
	info: { label: "Information", symbol: "i", color: EMAIL_BRAND_ACCENT },
	success: { label: "Success", symbol: "✓", color: "#00ca6e" },
	warning: { label: "Warning", symbol: "!", color: "#f09500" },
	error: { label: "Error", symbol: "!", color: "#ed2945" },
};

/** Shared notice styling, with a text label that remains meaningful without images. */
export function EmailNotice({ type, title, children }: { type: keyof typeof noticeTypes; title?: string; children?: ReactNode }) {
	const notice = noticeTypes[type];
	return (
		<Section className={`email-notice email-${type}`} style={{ backgroundColor: "#f5f3fa", borderLeft: `4px solid ${notice.color}`, borderRadius: "8px", padding: "16px", margin: "0 0 20px", color: "#34343c" }}>
			<Text style={{ fontWeight: "700", margin: children ? "0 0 8px" : "0", fontSize: "15px", lineHeight: "24px" }}>
				<span className={`email-icon-${type}`} aria-hidden='true' style={{ display: "inline-block", width: "24px", height: "24px", lineHeight: "24px", textAlign: "center", borderRadius: "50%", backgroundColor: notice.color, color: "#ffffff", fontSize: "18px", fontWeight: "700", marginRight: "8px" }}>
					{notice.symbol}
				</span>{" "}
				{title ?? notice.label}
			</Text>
			{children && <Text style={{ margin: "0", fontSize: "15px", lineHeight: "24px" }}>{children}</Text>}
		</Section>
	);
}

const paragraphStyle: CSSProperties = { overflowWrap: "anywhere", wordBreak: "break-word", color: "#34343c", fontSize: "16px", lineHeight: "26px", margin: "0 0 20px" };
const footerLinkStyle: CSSProperties = { color: "#666674", textDecoration: "underline" };

export function BrandedEmail({ content, baseUrl }: { content: BrandedEmailContent; baseUrl: string }) {
	const url = (path: string) => new URL(path, baseUrl).href;
	return (
		<Html lang='en'>
			<Head>
				<meta name='color-scheme' content='light dark' />
				<meta name='supported-color-schemes' content='light dark' />
				<style>{darkStyles}</style>
			</Head>
			<Preview>{content.preview ?? content.subject}</Preview>
			<Body className='email-background' style={{ backgroundColor: "#f5f5f8", fontFamily: "Arial, Helvetica, sans-serif", margin: "0", padding: "24px 12px" }}>
				<Container className='email-card' style={{ maxWidth: "600px", width: "100%", backgroundColor: "#ffffff", border: "1px solid #e6e6ee", borderTop: `4px solid ${EMAIL_BRAND_ACCENT}`, borderRadius: "12px" }}>
					<Section style={{ padding: "24px" }}>
						<Row>
							<Column style={{ width: "56px" }}>
								<Img src={url("/web-app-manifest-192x192.png")} alt='Clipify logo' width='44' height='44' style={{ display: "block", backgroundColor: "#ffffff", borderRadius: "8px" }} />
							</Column>
							<Column>
								<Text className='email-title' style={{ color: "#242432", fontSize: "24px", fontWeight: "700", margin: "0" }}>
									Clipify
								</Text>
								<Text style={{ fontSize: "13px", lineHeight: "20px", margin: "4px 0 0" }}>
									<Link className='email-link' href={url("/")} style={{ color: EMAIL_BRAND_ACCENT, textDecoration: "none" }}>
										clipify.us
									</Link>
								</Text>
							</Column>
						</Row>
					</Section>
					<Hr className='email-rule' style={{ borderColor: "#ededf3", margin: "0" }} />
					<Section style={{ padding: "28px 24px 12px" }}>
						<Heading className='email-title' as='h1' style={{ color: "#242432", fontSize: "24px", lineHeight: "32px", margin: "0 0 20px", overflowWrap: "anywhere" }}>
							{content.title ?? content.subject}
						</Heading>
						{(content.paragraphs ?? []).map((paragraph, index) => (
							<Text className='email-copy' key={index} style={paragraphStyle}>
								{paragraph}
							</Text>
						))}
						{content.children}
						{content.code && (
							<Text className='email-code' style={{ backgroundColor: "#f3efff", border: "1px solid #dfd4ff", borderRadius: "8px", color: EMAIL_BRAND_ACCENT, fontFamily: "Courier New, monospace", fontSize: "30px", fontWeight: "700", letterSpacing: "6px", textAlign: "center", padding: "20px 12px", margin: "4px 0 24px" }}>
								{content.code}
							</Text>
						)}
						{content.action && (
							<>
								<Button href={content.action.url} style={{ backgroundColor: EMAIL_BRAND_ACCENT, borderRadius: "8px", color: "#ffffff", fontSize: "16px", fontWeight: "700", padding: "14px 22px", textDecoration: "none" }}>
									{content.action.label}
								</Button>
								<Text className='email-muted' style={{ color: "#666674", fontSize: "13px", lineHeight: "20px", margin: "20px 0", overflowWrap: "anywhere", wordBreak: "break-all" }}>
									{content.action.url.startsWith("mailto:") ? "If the button doesn't work, send an email to:" : "If the button doesn't work, open this link:"}
									<br />
									<Link className='email-link' href={content.action.url} style={{ color: EMAIL_BRAND_ACCENT }}>
										{content.action.url.startsWith("mailto:") ? content.action.url.slice(7) : content.action.url}
									</Link>
								</Text>
							</>
						)}
					</Section>
					<Hr className='email-rule' style={{ borderColor: "#ededf3", margin: "0" }} />
					<Section style={{ padding: "20px 24px" }}>
						<Text className='email-muted' style={{ color: "#666674", fontSize: "12px", lineHeight: "20px", margin: "0 0 12px" }}>
							{content.receivingReason ?? (
								<>
									You are receiving this email because you have a Clipify account or requested it on{" "}
									<Link className='email-link' href={url("/")} style={footerLinkStyle}>
										clipify.us
									</Link>
									.
								</>
							)}
						</Text>
						<Text className='email-muted' style={{ color: "#666674", fontSize: "12px", lineHeight: "20px", margin: "0" }}>
							{"Clipify · Let your clips talk. Even when you can't."}
						</Text>
						<Text className='email-muted' style={{ color: "#666674", fontSize: "12px", lineHeight: "20px", margin: "8px 0 0" }}>
							<Link className='email-link' href={url("/")} style={footerLinkStyle}>
								Clipify
							</Link>
							{" · "}
							<Link className='email-link' href={EMAIL_HELP_CENTER_URL} style={footerLinkStyle}>
								Help Center
							</Link>
							{" · "}
							<Link className='email-link' href={EMAIL_SUPPORT_URL} style={footerLinkStyle}>
								{EMAIL_SUPPORT_ADDRESS}
							</Link>
							{" · "}
							<Link className='email-link' href={url("/legal/privacy")} style={footerLinkStyle}>
								Privacy
							</Link>
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}

export async function renderBrandedEmail(content: BrandedEmailContent) {
	const subject = content.subject
		.replace(/[\r\n]+/g, " ")
		.trim()
		.slice(0, 160);
	if (content.action && content.action.url !== EMAIL_SUPPORT_URL && !["https:", "http:"].includes(new URL(content.action.url).protocol)) throw new Error("INVALID_EMAIL_ACTION_URL");
	const html = await render(<BrandedEmail content={{ ...content, subject }} baseUrl={resolveBaseUrl().origin} />);
	return { subject, html, text: toPlainText(html) };
}
