// A Vercel Function, like the RSVP endpoint — but deliberately left open while
// NOTICE_ONLY is on, since the notice is the only place anyone can sign up.
export const prerender = false;

import type { APIRoute } from "astro";
import { notifySubscriber, saveSubscriber } from "@/lib/subscribers";

/** Loose on purpose: the browser checks shape, this only refuses junk. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function reply(request: Request, message: string, status: number) {
  // The cloth posts with fetch; a browser without JavaScript posts the
  // fallback form directly and should land on a page, not raw JSON.
  if (request.headers.get("accept")?.includes("application/json")) {
    return new Response(JSON.stringify({ message }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }
  const safe = message.replace(/[<>&]/g, "");
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Jacob &amp; Vicki</title><body style="font:20px/1.6 Georgia,serif;text-align:center;padding:20vh 24px;background:#fff8e9;color:#48201e"><p>${safe}</p><p><a href="/" style="color:#8f5147">Back</a></p>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData().catch(() => null);
  if (!data)
    return reply(request, "Something went wrong — please try again.", 400);

  // Hidden from people, irresistible to form-filling bots. Pretend it worked.
  if (String(data.get("website") ?? "")) {
    return reply(request, "Thank you! We’ll be in touch.", 200);
  }

  const email = String(data.get("email") ?? "").trim();
  if (email.length > 254 || !EMAIL.test(email)) {
    return reply(request, "That email doesn’t look quite right.", 400);
  }

  const record = {
    id: crypto.randomUUID(),
    subscribedAt: new Date().toISOString(),
    email,
  };
  if (!(await saveSubscriber(record))) {
    return reply(request, "We couldn’t save that — please try again.", 502);
  }
  await notifySubscriber(record);
  return reply(request, "Thank you! We’ll be in touch.", 200);
};
