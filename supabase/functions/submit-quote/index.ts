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

// ── In-Memory IP Rate Limiter (Max 5 quote submissions per 10 minutes per IP) ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function checkRateLimit(clientIp: string): boolean {
  if (!clientIp || clientIp === "unknown") return true;
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count += 1;
  return true;
}

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     "unknown";

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase server environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Service configuration error. Please try again later." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));

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

      // Check admin profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profile.role !== "admin") {
        return new Response(
          JSON.stringify({ success: false, error: "Forbidden: Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

      const tgData = await tgRes.json().catch(() => ({}));
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

    // Rate Limiting Check
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Too many submission attempts. Please wait a few minutes before submitting again."
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strict Input Validation & Length Limits
    const name = typeof body.name === "string" ? body.name.trim().substring(0, 100) : "";
    const phone = typeof body.phone === "string" ? body.phone.trim().substring(0, 20) : "";
    const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim().substring(0, 20) : phone;
    
    const ALLOWED_CATEGORIES = ["Aluminium", "uPVC", "Steel", "Not sure", "aluminium", "upvc", "steel"];
    const rawCategory = typeof body.category === "string" ? body.category.trim() : "Not sure";
    const category = ALLOWED_CATEGORIES.includes(rawCategory) ? rawCategory : "Not sure";

    const workTypes: string[] = Array.isArray(body.workTypes)
      ? body.workTypes.slice(0, 10).map((w: any) => String(w).trim().substring(0, 60))
      : [];

    const city = typeof body.city === "string" ? body.city.trim().substring(0, 100) : "Muzaffarpur";
    const locality = typeof body.locality === "string" ? body.locality.trim().substring(0, 150) : "";
    const message = typeof body.message === "string" ? body.message.trim().substring(0, 2000) : "";
    const referenceProject = typeof body.referenceProject === "string" ? body.referenceProject.trim().substring(0, 150) : "";
    
    // Sanitize reference images array (max 10 items)
    const referenceImages = Array.isArray(body.referenceImages)
      ? body.referenceImages.slice(0, 10).map((img: any) => {
          if (typeof img === "string") return img.substring(0, 500);
          if (img && typeof img === "object") {
            return {
              url: typeof img.url === "string" ? img.url.substring(0, 500) : "",
              public_id: typeof img.public_id === "string" ? img.public_id.substring(0, 200) : "",
              thumbnail: typeof img.thumbnail === "string" ? img.thumbnail.substring(0, 500) : ""
            };
          }
          return null;
        }).filter(Boolean)
      : [];

    const preferredContact = ["Phone Call", "WhatsApp", "Either"].includes(body.preferredContact)
      ? body.preferredContact
      : "Either";

    if (!name || name.length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: "Please enter a valid customer name (at least 2 characters)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const PHONE_REGEX = /^[0-9+() -]{10,20}$/;
    const phoneDigits = phone.replace(/[^\d]/g, "");
    if (!phone || !PHONE_REGEX.test(phone) || phoneDigits.length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: "Please enter a valid phone number with at least 10 digits." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const waDigits = whatsapp.replace(/[^\d]/g, "");
    if (!whatsapp || !PHONE_REGEX.test(whatsapp) || waDigits.length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: "Please enter a valid WhatsApp number with at least 10 digits." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step A: Insert Lead into Supabase Database (Source of Truth)
    const { data: lead, error: dbError } = await supabase
      .from("leads")
      .insert({
        name,
        phone,
        whatsapp: whatsapp || phone,
        category,
        work_types: workTypes,
        city: city || "Muzaffarpur",
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
      console.error("Database error saving lead:", dbError);
      return new Response(
        JSON.stringify({ success: false, error: "Unable to process quote submission right now. Please call us directly." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

        const tgData = await tgRes.json().catch(() => ({}));
        if (tgData.ok) {
          telegramSent = true;
        } else {
          telegramError = tgData.description || "Telegram API rejected message";
          console.error("Telegram error:", telegramError);
        }
      } catch (err: any) {
        telegramError = err?.message || "Failed to contact Telegram API";
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
      JSON.stringify({ success: false, error: "An unexpected error occurred. Please call or WhatsApp us directly." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
