// Helper: fetch Facebook Lead Form name
async function getFormName(formId, pageToken) {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v24.0/${formId}?fields=name&access_token=${encodeURIComponent(pageToken)}`
    );
    const data = await res.json();
    return data?.name || "Unknown Form";
  } catch (e) {
    console.error("Form name fetch error:", e);
    return "Unknown Form";
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* -------------------------------
       1) Webhook verification (GET)
    -------------------------------- */
    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === env.VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
      }
      return new Response("Verification failed", { status: 403 });
    }

    /* -------------------------------
       2) Webhook events (POST)
    -------------------------------- */
    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response("Bad JSON", { status: 400 });
      }

      console.log("Webhook received:", JSON.stringify(body));

      const change = body?.entry?.[0]?.changes?.[0];
      const value = change?.value;

      // Only process leadgen events
      if (change?.field !== "leadgen" || !value?.leadgen_id) {
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const leadgenId = value.leadgen_id;
      const formId = value.form_id;

      /* -------------------------------
         3) Fetch full lead details
      -------------------------------- */
      const leadRes = await fetch(
        `https://graph.facebook.com/v24.0/${leadgenId}?fields=created_time,field_data&access_token=${encodeURIComponent(env.META_PAGE_TOKEN)}`
      );
      const leadJson = await leadRes.json();

      console.log("Lead details:", JSON.stringify(leadJson));

      /* -------------------------------
         4) Fetch form name
      -------------------------------- */
      const formName = await getFormName(formId, env.META_PAGE_TOKEN);

      /* -------------------------------
         5) Build readable lead message
      -------------------------------- */
      const fields = leadJson?.field_data || [];
      const lines = fields.map(f => {
        const val = Array.isArray(f.values) ? f.values.join(", ") : "";
        return `${f.name}: ${val}`;
      });

      const message =
        `📥 *New Facebook Lead*\n\n` +
        `📝 *Form:* ${formName}\n` +
        `🆔 *Form ID:* ${formId}\n` +
        `🆔 *Lead ID:* ${leadgenId}\n\n` +
        lines.join("\n");

      /* -------------------------------
         6) Send to Telegram
      -------------------------------- */
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "Markdown",
        }),
      });

      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  }
};
