import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateIST(date: Date): string {
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase server environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();

    // ── 1. TEST TELEGRAM ACTION (Admin Only) ──
    if (body.action === "test_telegram") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid user session" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!botToken || !chatId) {
        return new Response(
          JSON.stringify({
            success: false,
            configured: false,
            error: "Telegram Bot Token or Chat ID not configured in Supabase Secrets."
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const testMsg = `✅ <b>Riddhi Siddhi Fabricator — Telegram Alert Test</b>\n\n` +
        `Telegram bot notifications are successfully configured and working!\n` +
        `🕐 <b>Time:</b> ${escapeHtml(formatDateIST(new Date()))}\n` +
        `👤 <b>Triggered by:</b> ${escapeHtml(user.email || "Admin")}`;

      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: testMsg,
          parse_mode: "HTML",
        }),
      });

      const tgData = await tgRes.json();
      if (!tgData.ok) {
        return new Response(
          JSON.stringify({ success: false, configured: true, error: tgData.description || "Telegram API error" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, configured: true, message: "Test message sent to Telegram successfully!" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. NEW QUOTE SUBMISSION ──
    const name = (body.name || "").trim();
    const phone = (body.phone || "").trim();
    const whatsapp = (body.whatsapp || phone).trim();
    const category = (body.category || "Not sure").trim();
    const workTypes: string[] = Array.isArray(body.workTypes) ? body.workTypes : [];
    const city = (body.city || "Muzaffarpur").trim();
    const locality = (body.locality || "").trim();
    const message = (body.message || "").trim();
    const referenceProject = (body.referenceProject || "").trim();
    const referenceImages = Array.isArray(body.referenceImages) ? body.referenceImages : [];
    const preferredContact = ["Phone Call", "WhatsApp", "Either"].includes(body.preferredContact)
      ? body.preferredContact
      : "Either";

    if (!name || !phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Name and phone number are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step A: Insert Lead into Supabase Database (Source of Truth)
    const { data: lead, error: dbError } = await supabase
      .from("leads")
      .insert({
        name,
        phone,
        whatsapp,
        category,
        work_types: workTypes,
        city,
        locality,
        message,
        reference_project: referenceProject,
        reference_images: referenceImages,
        preferred_contact: preferredContact,
        status: "new",
        source: "website",
      })
      .select()
      .single();

    if (dbError || !lead) {
      throw new Error(`Database error saving lead: ${dbError?.message}`);
    }

    const leadId = lead.id;
    const nowIST = formatDateIST(new Date());

    // Step B: Send Telegram Notification (Isolated failure handling)
    let telegramSent = false;
    let telegramError = "";

    if (botToken && chatId) {
      try {
        const fullLocation = locality ? `${locality}, ${city}` : city;
        const workString = workTypes.length > 0 ? workTypes.join(", ") : "General Enquiry";
        const imagesCount = referenceImages.length;

        let tgText = `🔔 <b>NEW QUOTE REQUEST</b>\n\n`;
        tgText += `👤 <b>Customer:</b> ${escapeHtml(name)}\n`;
        tgText += `📞 <b>Phone:</b> ${escapeHtml(phone)}\n`;
        if (whatsapp && whatsapp !== phone) {
          tgText += `💬 <b>WhatsApp:</b> ${escapeHtml(whatsapp)}\n`;
        }
        tgText += `\n🏗 <b>Material:</b> ${escapeHtml(category)}\n`;
        tgText += `🔨 <b>Work:</b> ${escapeHtml(workString)}\n`;
        tgText += `📍 <b>Location:</b> ${escapeHtml(fullLocation)}\n`;

        if (message) {
          tgText += `\n📝 <b>Message:</b>\n${escapeHtml(message)}\n`;
        }

        if (referenceProject) {
          tgText += `\n📌 <b>Ref Project:</b> ${escapeHtml(referenceProject)}\n`;
        }

        if (imagesCount > 0) {
          tgText += `📷 <b>Reference Images:</b> ${imagesCount} uploaded\n`;
        }

        tgText += `\n📞 <b>Preferred Contact:</b> ${escapeHtml(preferredContact)}\n`;
        tgText += `🕐 <b>Time:</b> ${escapeHtml(nowIST)}\n`;
        tgText += `🆔 <b>Lead ID:</b> <code>${escapeHtml(leadId)}</code>\n`;
        tgText += `🌐 <b>Source:</b> Website Quote Form`;

        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: tgText,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        });

        const tgData = await tgRes.json();
        if (tgData.ok) {
          telegramSent = true;
        } else {
          telegramError = tgData.description || "Telegram API rejected message";
          console.error("Telegram error:", telegramError);
        }
      } catch (err: any) {
        telegramError = err.message || "Failed to contact Telegram API";
        console.error("Telegram send exception:", err);
      }

      // Update lead record with notification status (silent update)
      try {
        await supabase
          .from("leads")
          .update({
            telegram_notification_sent: telegramSent,
            telegram_notification_sent_at: telegramSent ? new Date().toISOString() : null,
            telegram_notification_error: telegramError || null,
          })
          .eq("id", leadId);
      } catch (_) {
        // Non-blocking
      }
    }

    // Step C: Return Clean Confirmation to Customer
    return new Response(
      JSON.stringify({
        success: true,
        id: leadId,
        telegramNotified: telegramSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("submit-quote function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "An unexpected error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
