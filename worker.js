export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Meta webhook verification
    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === "my_meta_verify_2026") {
        return new Response(challenge, { status: 200 });
      }

      return new Response("Verification failed", { status: 403 });
    }

    // Meta webhook events
    if (request.method === "POST") {
      const body = await request.json();
      console.log("Webhook received:", body);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  }
};
