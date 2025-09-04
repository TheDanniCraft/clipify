"use server";

import { Feedback, RateLimitError } from "@types";
import { validateAuth } from "@actions/auth";
import { tryRateLimit } from "@actions/rateLimit";
import axios, { AxiosResponse } from "axios";

const apiUrl = `${process.env.FIDER_BASE_URL}/api/v1`;
const apiToken = process.env.FIDER_API_KEY;

const feedbackTypeTagMap: Record<string, string> = {
	bug: "bug",
	feature: "feature-request",
	feedback: "feedback",
};

interface FiderUser {
	id: number;
	name: string;
	email: string;
	externalId: string;
}

export interface FiderPost {
	id: number;
	number: number;
	title: string;
	slug: string;
	html_url: string;
}

export async function submitFeedback(feedback: Feedback): Promise<FiderPost | null> {
	const isAuthenticated = await validateAuth(true);
	if (!isAuthenticated) {
		console.warn(`Unauthenticated feedback submission attempt`);
		throw new Error("Unauthenticated");
	}

	const rateLimiter = await tryRateLimit({ key: "feedback", points: 1, duration: 20 });

	if (!rateLimiter.success) {
		throw new RateLimitError();
	}

	const fiderUser = await createUser(isAuthenticated.username, isAuthenticated.email, isAuthenticated.id);

	const fiderFeedback = await createFeedback(fiderUser.id, feedback);

	fiderFeedback.html_url = `${process.env.FIDER_BASE_URL}/posts/${fiderFeedback.id}/${fiderFeedback.slug}`;
	return fiderFeedback;
}

async function createUser(name: string, email: string, userId: string): Promise<FiderUser> {
	try {
		const response: AxiosResponse<FiderUser> = await axios.post(
			`${apiUrl}/users`,
			{
				name,
				email,
				externalId: userId,
			},
			{
				headers: {
					Authorization: `Bearer ${apiToken}`,
					"Content-Type": "application/json",
				},
			}
		);
		return response.data;
	} catch (error) {
		if (axios.isAxiosError(error)) {
			console.error("Axios error creating user:", error.response?.data || error.message);
		} else {
			console.error("Error creating user:", error);
		}
		throw new Error("Failed to create user");
	}
}

async function createFeedback(fiderUserId: number, feedback: Feedback): Promise<FiderPost> {
	try {
		const randomId = Math.random().toString(36).slice(2, 6);

		const response: AxiosResponse<FiderPost> = await axios.post(
			`${apiUrl}/posts`,
			{
				title: `${feedback.feedback.title} [WIDGET-${randomId}]`,
				description: feedback.feedback.comment,
			},
			{
				headers: {
					Authorization: `Bearer ${apiToken}`,
					"Content-Type": "application/json",
					"X-Fider-UserID": fiderUserId,
				},
			}
		);

		await tagPost(response.data.id, feedbackTypeTagMap[feedback.type]);

		if (feedback.type == "feedback" && feedback.feedback.rating) {
			let ratingTag: string;
			switch (feedback.feedback.rating) {
				case "bad":
					ratingTag = "bad";
					break;
				case "poor":
					ratingTag = "poor";
					break;
				case "neutral":
					ratingTag = "neutral";
					break;
				case "great":
					ratingTag = "great";
					break;
				case "excellent":
					ratingTag = "excellent";
					break;
				default:
					ratingTag = "neutral";
			}
			await tagPost(response.data.id, ratingTag);
		}

		return response.data;
	} catch (error) {
		if (axios.isAxiosError(error)) {
			console.error("Axios error creating feedback:", error.response?.data || error.message);
		} else {
			console.error("Error creating feedback:", error);
		}
		throw new Error("Failed to create feedback");
	}
}

async function tagPost(postId: number, tag: string): Promise<void> {
	try {
		await axios.post(
			`${apiUrl}/posts/${postId}/tags/${tag}`,
			{},
			{
				headers: {
					Authorization: `Bearer ${apiToken}`,
					"Content-Type": "application/json",
				},
			}
		);
	} catch (error) {
		if (axios.isAxiosError(error)) {
			console.error("Axios error tagging post:", error.response?.data || error.message);
		} else {
			console.error("Error tagging post:", error);
		}
		throw new Error("Failed to tag post");
	}
}
