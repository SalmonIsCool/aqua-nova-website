import type { Handler } from "@netlify/functions";
import { authenticateHubRequest } from "./lib/auth";
import { truckyFetch } from "./lib/trucky";

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store"
    },
    body: JSON.stringify(body)
  };
}

export const handler: Handler = async (event, context) => {
  const auth = await authenticateHubRequest(context, event.headers);
  if (!auth.ok) return json(auth.statusCode, { error: auth.error });

  const jobId = event.queryStringParameters?.id;
  if (!jobId) {
    return json(400, { error: "Job ID is required." });
  }

  try {
    const response = await truckyFetch(`/api/v1/job/${jobId}`);
    if (!response.ok) {
      return json(response.status, { error: "Could not load job from Trucky." });
    }

    const job = await response.json();

    if (Number(job.user_id) !== auth.driver.truckyUserId) {
      return json(403, { error: "You do not have access to this job." });
    }

    const eventsResponse = await truckyFetch(`/api/v1/job/${jobId}/events`);
    const fetchedEvents = eventsResponse.ok ? await eventsResponse.json() : [];
    const fromApi = Array.isArray(fetchedEvents) ? fetchedEvents : Array.isArray(fetchedEvents?.data) ? fetchedEvents.data : [];
    const fromJob = Array.isArray(job.events) ? job.events : [];
    const events = [...fromJob, ...fromApi].filter(
      (event, index, list) => list.findIndex((item) => item.id === event.id) === index
    );

    return json(200, {
      driver: auth.driver,
      job,
      events
    });
  } catch {
    return json(500, { error: "Failed to load job details." });
  }
};
