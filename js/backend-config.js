/**
 * Riddhi Siddhi Fabricator — Backend Configuration (Supabase + Cloudinary)
 * 
 * Connected Projects:
 *   - Supabase: https://gpcgbafqifufkasyzjvt.supabase.co
 *   - Cloudinary: ealgnhba
 * 
 * NOTE: Private credentials (SUPABASE_SERVICE_ROLE_KEY, CLOUDINARY_API_SECRET)
 * are NEVER stored in frontend code and remain strictly server-side in Edge Functions.
 */

window.RS_BACKEND_CONFIG = {
  // Supabase Public Configuration
  supabaseUrl: "https://gpcgbafqifufkasyzjvt.supabase.co",
  supabaseAnonKey: "sb_publishable_utZ9qGlxm6IIfpKuIFsTfA_4OlHeHD3",

  // Cloudinary Public Configuration
  cloudinaryCloudName: "ealgnhba",
  cloudinaryApiKey: "745176677867224",
  cloudinaryUploadPreset: "riddhi_siddhi_public"
};

// Detect if Supabase & Cloudinary are connected
window.RS_IS_BACKEND_CONFIGURED = Boolean(
  window.RS_BACKEND_CONFIG &&
  window.RS_BACKEND_CONFIG.supabaseUrl &&
  window.RS_BACKEND_CONFIG.supabaseAnonKey &&
  window.RS_BACKEND_CONFIG.supabaseUrl.trim() !== "" &&
  window.RS_BACKEND_CONFIG.supabaseAnonKey.trim() !== ""
);
