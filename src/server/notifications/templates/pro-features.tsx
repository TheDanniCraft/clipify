import { Section, Text } from "@react-email/components";
import { tiers } from "@/app/components/Pricing/pricing-catalog";
import { TiersEnum } from "@/app/components/Pricing/pricing-types";

export function ProFeatureList({ ended = false }: { ended?: boolean }) {
	return (
		<Section style={{ marginBottom: "20px" }}>
			<Text className='email-copy' style={{ fontSize: "15px", lineHeight: "24px", margin: "0 0 8px" }}>
				{ended ? "You no longer have access to the following features:" : "You will lose access to the following features:"}
			</Text>
			<ul className='email-copy' style={{ fontSize: "15px", lineHeight: "24px", margin: "0", paddingLeft: "22px", listStyleType: "disc" }}>
				{(tiers.find((tier) => tier.key === TiersEnum.Pro)?.summaryFeatures ?? []).map((feature) => (
					<li key={feature} style={{ marginBottom: "4px" }}>
						{feature}
					</li>
				))}
			</ul>
		</Section>
	);
}
