// Supabase Edge Function: Cloudinary Upload Signature Generator
// Validates caller is an authenticated Admin and returns signed upload parameters.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const cloudinaryCloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME") || "ealgnhba";
    const cloudinaryApiKey = Deno.env.get("CLOUDINARY_API_KEY") || "745176677867224";
    const cloudinaryApiSecret = Deno.env.get("CLOUDINARY_API_SECRET") ?? "";

    if (!cloudinaryApiSecret) {
      return new Response(JSON.stringify({ error: "Missing CLOUDINARY_API_SECRET secret in Supabase Edge Function environment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Verify User Authentication & Admin Role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: `Unauthorized: ${authError?.message || "Invalid or expired token"}` }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin profile
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Verified admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Generate Cloudinary Signature with Whitelisted Folder Path
    const body = await req.json().catch(() => ({ folder: "riddhi-siddhi/projects" }));
    const rawFolder = typeof body?.folder === "string" ? body.folder.trim() : "riddhi-siddhi/projects";
    
    // Strict whitelist: Only allow approved project & lead image upload destinations
    const ALLOWED_FOLDER_PATTERN = /^riddhi-siddhi\/(projects(\/(covers|gallery))?|leads|uploads)$/;
    const folder = ALLOWED_FOLDER_PATTERN.test(rawFolder) ? rawFolder : "riddhi-siddhi/projects";
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Cloudinary signature is SHA-1 of sorted query string parameters + api_secret
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${cloudinaryApiSecret}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(paramsToSign);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    return new Response(
      JSON.stringify({
        signature,
        timestamp,
        apiKey: cloudinaryApiKey,
        cloudName: cloudinaryCloudName,
        folder,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("cloudinary-signature error:", error?.message || error);
    return new Response(JSON.stringify({ error: "Failed to generate upload signature. Please try again." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
