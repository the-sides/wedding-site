/*
 * The "tell me when there's news" list behind the notice's sign-up field.
 *
 * Stored exactly like the RSVP backups — one private JSON file per sign-up,
 * logged first — because the same trade applies: there is nothing to send
 * these addresses yet, so the only job is to never lose one. Read them back
 * with `bun scripts/dump-subscribers.ts`.
 */

import { put } from "@vercel/blob";
import {
  BLOB_READ_WRITE_TOKEN,
  BLOB_STORE_ID,
  DISCORD_RSVP_WEBHOOK_URL,
} from "astro:env/server";

export interface SubscriberRecord {
  id: string;
  subscribedAt: string;
  email: string;
}

export const SUBSCRIBER_PREFIX = "subscribers/";

/** Same reasoning as the RSVP backup: a sick store costs a pause, not the form. */
const BLOB_TIMEOUT_MS = 5_000;
const DISCORD_TIMEOUT_MS = 3_000;

/**
 * Never throws. Returns false only when the address reached nowhere durable
 * beyond the log line, so the guest can be told to try again.
 */
export async function saveSubscriber(
  record: SubscriberRecord,
): Promise<boolean> {
  console.log("Subscriber received", JSON.stringify(record));

  if (!BLOB_READ_WRITE_TOKEN && !BLOB_STORE_ID) {
    console.warn("No Blob credentials — subscriber kept in logs only");
    return true;
  }

  const stamp = record.subscribedAt.replace(/[:.]/g, "-");
  const pathname = `${SUBSCRIBER_PREFIX}${stamp}-${record.id}.json`;
  try {
    await put(pathname, JSON.stringify(record, null, 2), {
      access: "private",
      ...(BLOB_READ_WRITE_TOKEN ? { token: BLOB_READ_WRITE_TOKEN } : {}),
      contentType: "application/json",
      addRandomSuffix: false,
      abortSignal: AbortSignal.timeout(BLOB_TIMEOUT_MS),
    });
    return true;
  } catch (error) {
    console.error(`Failed to save subscriber (path=${pathname}):`, error);
    return false;
  }
}

/**
 * A quiet line in the RSVP channel. No mention: a sign-up is nice to see, not
 * something to be woken for. The address goes in the embed so Discord never
 * resolves anything a visitor typed.
 */
export async function notifySubscriber(
  record: SubscriberRecord,
): Promise<void> {
  if (!DISCORD_RSVP_WEBHOOK_URL) return;
  try {
    const response = await fetch(DISCORD_RSVP_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "New notice sign-up",
            description: record.email.replace(/([\\*_~`|>#\-[\]()])/g, "\\$1"),
            color: 0x8f5147,
            timestamp: record.subscribedAt,
            footer: { text: record.id },
          },
        ],
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(
        `Discord rejected the sign-up notification (status=${response.status})`,
      );
    }
  } catch (error) {
    console.error("Failed to notify Discord of a sign-up:", error);
  }
}
