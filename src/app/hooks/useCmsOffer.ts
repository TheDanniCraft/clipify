"use client";

import { useEffect, useState } from "react";
import type { CampaignOffer } from "@types";

type ActiveOfferResponse = {
	offer: CampaignOffer | null;
};

export function useCmsOffer() {
	const [campaignOffer, setCampaignOffer] = useState<CampaignOffer | null>(null);

	useEffect(() => {
		let mounted = true;

		const fetchOffer = async () => {
			try {
				const response = await fetch("/api/offers/active", { method: "GET", cache: "no-store" });
				if (!response.ok) return;
				const payload = (await response.json()) as ActiveOfferResponse;
				if (mounted) setCampaignOffer(payload.offer ?? null);
			} catch {
				// Ignore network/API errors and keep offer surfaces hidden.
			}
		};

		void fetchOffer();
		return () => {
			mounted = false;
		};
	}, []);

	return campaignOffer;
}

