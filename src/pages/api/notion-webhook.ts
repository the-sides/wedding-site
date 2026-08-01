import type { APIRoute } from "astro";
import { VERCEL_DEPLOY_HOOK } from "astro:env/server";

// Every other route is prerendered; this one has to run on demand so Notion
// can call it and trigger a rebuild.
export const prerender = false;

export const GET: APIRoute = () => {
  return json({ success: true });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await readJsonBody(request);

  if (body?.verification_token) {
    console.log("===========================================");
    console.log("NOTION WEBHOOK VERIFICATION TOKEN:");
    console.log(body.verification_token);
    console.log("===========================================");

    return json({ success: true });
  }

  console.log("Notion webhook received:", body?.type ?? "unknown");

  if (!VERCEL_DEPLOY_HOOK) {
    console.warn("VERCEL_DEPLOY_HOOK not configured");
    return json({ success: true, deployTriggered: false });
  }

  try {
    const response = await fetch(VERCEL_DEPLOY_HOOK, { method: "POST" });

    if (!response.ok) {
      console.error("Failed to trigger Vercel deploy:", response.status);
      return json({ error: "Failed to trigger deploy" }, 500);
    }

    console.log("Vercel rebuild triggered successfully");
    return json({ success: true, deployTriggered: true });
  } catch (error) {
    console.error("Error triggering Vercel deploy:", error);
    return json({ error: "Failed to trigger deploy" }, 500);
  }
};

export const ALL: APIRoute = () => {
  return json({ error: "Method not allowed" }, 405);
};

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
