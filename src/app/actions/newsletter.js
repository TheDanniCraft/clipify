"use server";

import axios from "axios";

const LISTMONK_URL = process.env.LISTMONK_URL;
const LISTMONK_LIST_UUID = process.env.LISTMONK_LIST_UUID;
const LISTMONK_USERNAME = process.env.LISTMONK_USERNAME;
const LISTMONK_API_KEY = process.env.LISTMONK_API_KEY;

export async function subscribeToNewsletter(email) {
    if (!LISTMONK_URL || !LISTMONK_LIST_UUID || !LISTMONK_USERNAME || !LISTMONK_API_KEY) {
        throw new Error("Missing Listmonk configuration in environment variables");
    }

    try {
        const response = await axios.post(
            `${LISTMONK_URL}/api/public/subscription`,
            {
                email,
                list_uuids: [LISTMONK_LIST_UUID],
                status: 'enabled',
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Basic ${Buffer.from(`${LISTMONK_USERNAME}:${LISTMONK_API_KEY}`).toString('base64')}`,
                },
            }
        );

        return response.data;
    } catch (error) {
        console.error(error);

        throw new Error("Failed to subscribe to newsletter");
    }
}