export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1) Meta Webhook Verification (GET)
    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === env.VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
      }
      return new Response("Verification failed", { status: 403 });
    }

    // 2) Meta Webhook Events (POST)
    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response("Bad JSON", { status: 400 });
      }

      console.log("Webhook received:", JSON.stringify(body));

      // We only care about leadgen changes
      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      if (change?.field !== "leadgen" || !value?.leadgen_id) {
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const leadgenId = value.leadgen_id;

      // 3) Fetch full lead data from Meta Graph API
      // Note: This needs a Page Access Token with leads_retrieval permission
      const leadUrl =
        `https://graph.facebook.com/v24.0/${leadgenId}` +
        `?fields=created_time,field_data` +
        `&access_token=${encodeURIComponent(env.META_PAGE_TOKEN)}`;

      const leadRes = await fetch(leadUrl);
      const leadJson = await leadRes.json();

      console.log("Lead details:", JSON.stringify(leadJson));

      // 4) Convert field_data to readable text
      const fields = leadJson?.field_data || [];
      const lines = fields.map(f => {
        const val = Array.isArray(f.values) ? f.values.join(", ") : "";
        return `${f.name}: ${val}`;
      });

      const msg =
        `✅ New Lead Received\n` +
        `Lead ID: ${leadgenId}\n` +
        `Created: ${leadJson?.created_time || "unknown"}\n\n` +
        lines.join("\n");

      // 5) Send to Telegram
      const tgUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      const tgRes = await fetch(tgUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: msg,
        }),
      });

      const tgJson = await tgRes.json();
      console.log("Telegram response:", JSON.stringify(tgJson));

      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  }
};
