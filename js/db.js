/**
 * Riddhi Siddhi Fabricator — Unified Data & Storage Layer
 * 
 * BACKEND ARCHITECTURE:
 *   - Database, Auth & RLS: SUPABASE (PostgreSQL)
 *   - Media Storage & CDN: CLOUDINARY (Optimized WebP/AVIF delivery)
 * 
 * LOCAL/OFFLINE RESILIENCE:
 *   - Transparently falls back to IndexedDB if Supabase credentials are unset or offline.
 */

const LOCAL_STORAGE_SESSION_KEY = "rs_admin_session_demo";

const DB = {
  _supabase: null,
  _initialized: false,
  _initPromise: null,

  isSupabaseMode() {
    return Boolean(window.RS_IS_BACKEND_CONFIGURED && this._supabase);
  },

  async init() {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      if (window.RS_IS_BACKEND_CONFIGURED) {
        try {
          let createClient = window.supabase?.createClient;
          if (!createClient) {
            const module = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.8/+esm");
            createClient = module.createClient;
          }
          this._supabase = createClient(
            window.RS_BACKEND_CONFIG.supabaseUrl,
            window.RS_BACKEND_CONFIG.supabaseAnonKey,
            {
              auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
              }
            }
          );
          console.log("Riddhi Siddhi DB: Initialized with SUPABASE + CLOUDINARY.");
        } catch (err) {
          console.warn("Could not initialize Supabase, falling back to local mode:", err);
          this._supabase = null;
        }
      } else {
        console.log("Riddhi Siddhi DB: Running in DEMO / LOCAL MODE (IndexedDB).");
      }
      this._initialized = true;
    })();

    return this._initPromise;
  },

  // Generate clean URL slug
  generateSlug(name) {
    if (!name) return "project-" + Date.now();
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  },

  // ══════════════════════════════════════════════════
  // CLOUDINARY MEDIA OPTIMIZATION & UPLOAD
  // ══════════════════════════════════════════════════

  // Generate Cloudinary optimized URL with transformation
  getCloudinaryUrl(urlOrPublicId, transform = "f_auto,q_auto") {
    if (!urlOrPublicId) return "";
    const cloudName = window.RS_BACKEND_CONFIG?.cloudinaryCloudName;
    if (urlOrPublicId.startsWith("http://") || urlOrPublicId.startsWith("https://") || urlOrPublicId.startsWith("data:")) {
      if (urlOrPublicId.includes("cloudinary.com") && !urlOrPublicId.includes("/upload/" + transform)) {
        return urlOrPublicId.replace("/upload/", `/upload/${transform}/`);
      }
      return urlOrPublicId;
    }
    if (!cloudName) return urlOrPublicId;
    return `https://res.cloudinary.com/${cloudName}/image/upload/${transform}/${urlOrPublicId}`;
  },

  // Client-side quick compression to reduce multi-megabyte photos to fast web-ready sizes before network upload
  async compressImage(file, maxDimension = 1920, quality = 0.85) {
    if (!file || !file.type.startsWith("image/") || file.type === "image/svg+xml") {
      return file;
    }
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob && blob.size < file.size) {
                resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".webp"), { type: "image/webp" }));
              } else {
                resolve(file);
              }
            },
            "image/webp",
            quality
          );
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  },

  // Upload image to Cloudinary (or IndexedDB in demo mode)
  async uploadImage(file, folder = "riddhi-siddhi/projects") {
    await this.init();

    if (!file || typeof file !== "object") {
      throw new Error("Invalid file provided for upload.");
    }

    // ── Security Check 1: File Size Limit (Max 10 MB) ──
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File "${file.name}" exceeds maximum allowed size (10 MB).`);
    }

    // ── Security Check 2: MIME Type Whitelist ──
    const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/jpg"];
    if (!ALLOWED_MIME_TYPES.includes((file.type || "").toLowerCase())) {
      throw new Error(`Invalid file type "${file.type}". Only JPEG, PNG, WebP, and AVIF images are permitted.`);
    }

    // ── Security Check 3: File Extension Whitelist (Reject dangerous/executable files) ──
    const fileName = (file.name || "").toLowerCase();
    const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"];
    const hasAllowedExt = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
    if (!hasAllowedExt) {
      throw new Error(`Invalid file extension for "${file.name}". Only .jpg, .jpeg, .png, .webp, and .avif images are permitted.`);
    }

    // ── Security Check 4: Folder Whitelist ──
    const ALLOWED_FOLDER_PATTERN = /^riddhi-siddhi\/(projects(\/(covers|gallery))?|leads|uploads)$/;
    const targetFolder = ALLOWED_FOLDER_PATTERN.test(folder) ? folder : "riddhi-siddhi/projects";

    const id = "img_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    const cloudName = window.RS_BACKEND_CONFIG?.cloudinaryCloudName;

    if (this.isSupabaseMode() && cloudName) {
      try {
        // Fast client-side compression before sending over network
        const optimizedFile = await this.compressImage(file);

        const formData = new FormData();
        formData.append("file", optimizedFile);
        formData.append("folder", targetFolder);

        let isSigned = false;

        // Try getting signature from Supabase Edge Function if user is logged in
        if (AdminAuth.isAuthenticated()) {
          const { data: signData, error: signErr } = await this._supabase.functions.invoke("cloudinary-signature", {
            body: { folder: targetFolder }
          });
          if (signErr) {
            console.error("Supabase signature error:", signErr);
            let detail = signErr.message;
            if (signErr.context && typeof signErr.context.json === "function") {
              try {
                const body = await signErr.context.json();
                if (body && body.error) detail = body.error;
              } catch (e) {}
            }
            throw new Error("Cloudinary Signature Error: " + detail);
          }
          if (signData && signData.signature) {
            formData.append("api_key", signData.apiKey);
            formData.append("timestamp", signData.timestamp);
            formData.append("signature", signData.signature);
            isSigned = true;
          }
        }

        if (!isSigned) {
          formData.append("upload_preset", window.RS_BACKEND_CONFIG.cloudinaryUploadPreset || "riddhi_siddhi_public");
        }

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: formData
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Cloudinary upload failed with status ${res.status}`);
        }

        const data = await res.json();
        const publicId = data.public_id;
        const secureUrl = data.secure_url;
        const thumbnailUrl = this.getCloudinaryUrl(publicId, "c_fill,w_640,h_480,f_auto,q_auto");

        return {
          id,
          public_id: publicId,
          url: secureUrl,
          secure_url: secureUrl,
          thumbnail: thumbnailUrl,
          thumbnail_url: thumbnailUrl,
          name: file.name
        };
      } catch (err) {
        console.error("Cloudinary upload failed:", err);
        throw err;
      }
    }

    // Local / Demo Mode fallback
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target.result;
        try {
          const idb = await this._initIDB();
          if (idb) {
            const tx = idb.transaction("images", "readwrite");
            tx.objectStore("images").put({ id, dataUrl, name: file.name });
          }
        } catch (err) {}

        resolve({
          id,
          public_id: id,
          url: dataUrl,
          secure_url: dataUrl,
          thumbnail: dataUrl,
          thumbnail_url: dataUrl,
          name: file.name
        });
      };
      reader.readAsDataURL(file);
    });
  },

  // ══════════════════════════════════════════════════
  // PROJECTS PORTFOLIO (SUPABASE POSTGRESQL)
  // ══════════════════════════════════════════════════

  async getAllProjects(onlyPublished = false) {
    await this.init();

    if (this.isSupabaseMode()) {
      try {
        let query = this._supabase
          .from("projects")
          .select(`
            *,
            project_images (
              id,
              public_id,
              secure_url,
              thumbnail_url,
              alt_text,
              sort_order,
              is_cover
            )
          `)
          .order("created_at", { ascending: false });

        if (onlyPublished) {
          query = query.eq("published", true);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Normalize response format
        return (data || []).map((p) => {
          const rawImages = (p.project_images || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          const images = rawImages.map(img => ({
            id: img.id,
            public_id: img.public_id,
            url: img.secure_url || img.thumbnail_url || img.url || "",
            secure_url: img.secure_url || img.thumbnail_url || img.url || "",
            thumbnail: img.thumbnail_url || img.secure_url || img.thumbnail || "",
            thumbnail_url: img.thumbnail_url || img.secure_url || img.thumbnail || "",
            alt_text: img.alt_text || p.name,
            sort_order: img.sort_order,
            is_cover: img.is_cover
          }));

          const rawCover = images.find((img) => img.is_cover) || images[0] || p.cover_image || {};
          const coverUrl = rawCover.secure_url || rawCover.url || (typeof rawCover === "string" ? rawCover : "");
          const coverThumb = rawCover.thumbnail_url || rawCover.thumbnail || coverUrl;

          const cover = {
            public_id: rawCover.public_id || "",
            url: coverUrl,
            secure_url: coverUrl,
            thumbnail: coverThumb,
            thumbnail_url: coverThumb
          };

          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            category: (p.category || "").toLowerCase(),
            shortDescription: p.short_description || "",
            description: p.description || "",
            location: p.location || "",
            year: p.year || "",
            services: p.services || "",
            featured: Boolean(p.featured === true || p.featured === "true" || p.featured === 1),
            published: Boolean(p.published === true || p.published === "true" || p.published === 1),
            coverImage: cover,
            galleryImages: images,
            createdAt: p.created_at,
            updatedAt: p.updated_at
          };
        });
      } catch (err) {
        console.error("Supabase error in getAllProjects:", err);
      }
    }

    return this._getLocalProjects(onlyPublished);
  },

  async getProjectsByCategory(category, onlyPublished = true) {
    const catLower = (category || "").toLowerCase().trim();
    const all = await this.getAllProjects(onlyPublished);
    if (catLower === "featured") {
      return all.filter((p) => Boolean(p.featured === true || p.featured === "true" || p.featured === 1));
    }
    return all.filter((p) => (p.category || "").toLowerCase() === catLower);
  },

  async getProjectBySlug(category, slug) {
    const catLower = (category || "").toLowerCase().trim();
    const slugLower = (slug || "").toLowerCase().trim();
    const all = await this.getAllProjects(true);
    return (
      all.find(
        (p) =>
          (!catLower || (p.category || "").toLowerCase() === catLower) &&
          (p.slug || "").toLowerCase() === slugLower
      ) ||
      all.find((p) => (p.slug || "").toLowerCase() === slugLower) ||
      all.find((p) => String(p.id) === slugLower) ||
      null
    );
  },

  async getProjectById(id) {
    if (!id) return null;
    const cleanId = String(id).trim().toLowerCase();
    const all = await this.getAllProjects(false);
    return (
      all.find((p) => String(p.id).toLowerCase() === cleanId) ||
      all.find((p) => (p.slug || "").toLowerCase() === cleanId) ||
      null
    );
  },

  async saveProject(projectData) {
    await this.init();
    if (!projectData || typeof projectData !== "object") {
      throw new Error("Invalid project data provided.");
    }

    const name = String(projectData.name || "").trim().substring(0, 200);
    if (!name || name.length < 2) {
      throw new Error("Project name is required (minimum 2 characters).");
    }

    const ALLOWED_CATEGORIES = ["aluminium", "upvc", "steel"];
    const rawCategory = String(projectData.category || "aluminium").toLowerCase().trim();
    const cleanCategory = ALLOWED_CATEGORIES.includes(rawCategory) ? rawCategory : "aluminium";

    const rawSlug = projectData.slug ? this.generateSlug(projectData.slug) : this.generateSlug(name);
    const slug = rawSlug.substring(0, 100);

    const isNew = !projectData.id;

    const cover = projectData.coverImage;
    const coverUrl = cover?.secure_url || cover?.url || (typeof cover === 'string' ? cover : null);
    const coverThumb = cover?.thumbnail_url || cover?.thumbnail || coverUrl;
    const coverObj = coverUrl ? {
      public_id: cover?.public_id || "cover_" + Date.now(),
      secure_url: coverUrl,
      thumbnail_url: coverThumb
    } : null;

    const isFeatured = Boolean(projectData.featured === true || projectData.featured === "true" || projectData.featured === 1);
    const isPublished = Boolean(projectData.published === true || projectData.published === "true" || projectData.published === 1);

    if (this.isSupabaseMode()) {
      try {
        const projectPayload = {
          name,
          slug,
          category: cleanCategory,
          cover_image: coverObj,
          short_description: String(projectData.shortDescription || "").trim().substring(0, 500),
          description: String(projectData.description || "").trim().substring(0, 5000),
          location: String(projectData.location || "").trim().substring(0, 100),
          year: String(projectData.year || new Date().getFullYear()).trim().substring(0, 10),
          services: String(projectData.services || "").trim().substring(0, 200),
          featured: isFeatured,
          published: isPublished,
          updated_at: new Date().toISOString()
        };

        let projectId = projectData.id;

        if (isNew) {
          const { data: createdProj, error: createErr } = await this._supabase
            .from("projects")
            .insert([projectPayload])
            .select()
            .single();

          if (createErr) throw createErr;
          projectId = createdProj.id;
        } else {
          const { data: updatedRows, error: updateErr } = await this._supabase
            .from("projects")
            .update(projectPayload)
            .eq("id", projectId)
            .select();

          if (updateErr) throw updateErr;
          if (!updatedRows || updatedRows.length === 0) {
            throw new Error("Unable to update project. Please ensure you are logged in as an authenticated admin.");
          }

          // Delete existing images to replace with updated set
          await this._supabase.from("project_images").delete().eq("project_id", projectId);
        }

        // Insert project_images
        const gallery = Array.isArray(projectData.galleryImages) ? projectData.galleryImages : [];
        const allImagesToInsert = [];

        if (coverUrl) {
          allImagesToInsert.push({
            project_id: projectId,
            public_id: cover?.public_id || "cover_" + Date.now(),
            secure_url: coverUrl,
            thumbnail_url: coverThumb,
            alt_text: name + " Cover",
            sort_order: 0,
            is_cover: true
          });
        }

        gallery.forEach((img, idx) => {
          const gUrl = img.secure_url || img.url || (typeof img === 'string' ? img : null);
          if (gUrl && gUrl !== coverUrl) {
            allImagesToInsert.push({
              project_id: projectId,
              public_id: img.public_id || `gallery_${Date.now()}_${idx}`,
              secure_url: gUrl,
              thumbnail_url: img.thumbnail_url || img.thumbnail || gUrl,
              alt_text: `${name} Photo ${idx + 1}`,
              sort_order: idx + 1,
              is_cover: false
            });
          }
        });

        if (allImagesToInsert.length > 0) {
          const { error: imgErr } = await this._supabase.from("project_images").insert(allImagesToInsert);
          if (imgErr) console.warn("Error inserting project images:", imgErr);
        }

        const saved = await this.getProjectById(projectId);
        if (saved) {
          await this._saveLocalProject(saved);
        }
        return saved;
      } catch (err) {
        console.error("Supabase error saving project:", err);
        alert("Project save error: " + (err.message || "Failed to write to database"));
        throw err;
      }
    }

    // Local / Demo Mode fallback
    const id = projectData.id || "proj_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    const localProject = {
      id,
      name: projectData.name || "Untitled Project",
      slug,
      category: cleanCategory,
      coverImage: projectData.coverImage,
      galleryImages: projectData.galleryImages || [],
      shortDescription: projectData.shortDescription || "",
      description: projectData.description || "",
      location: projectData.location || "",
      year: projectData.year || String(new Date().getFullYear()),
      services: projectData.services || "",
      featured: Boolean(projectData.featured),
      published: Boolean(projectData.published),
      createdAt: projectData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this._saveLocalProject(localProject);
    return localProject;
  },

  async deleteProject(id) {
    await this.init();

    if (this.isSupabaseMode()) {
      try {
        const { error } = await this._supabase.from("projects").delete().eq("id", id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error("Supabase error deleting project:", err);
      }
    }

    return this._deleteLocalProject(id);
  },

  async togglePublish(id) {
    const proj = await this.getProjectById(id);
    if (!proj) return null;
    proj.published = !proj.published;
    return this.saveProject(proj);
  },

  // ══════════════════════════════════════════════════
  // LEADS & QUOTE ENQUIRIES
  // ══════════════════════════════════════════════════

  async createLead(leadData) {
    await this.init();
    if (!leadData || typeof leadData !== "object") {
      throw new Error("Invalid quote request data.");
    }

    const name = (leadData.name || "").trim().substring(0, 100);
    const phone = (leadData.phone || "").trim().substring(0, 20);
    const whatsapp = (leadData.whatsapp || leadData.phone || "").trim().substring(0, 20);

    const phoneDigits = phone.replace(/[^\d]/g, "");
    if (phoneDigits.length < 10) {
      throw new Error("Phone number must have at least 10 digits.");
    }

    const waDigits = whatsapp.replace(/[^\d]/g, "");
    if (waDigits.length < 10) {
      throw new Error("WhatsApp number must have at least 10 digits.");
    }

    const now = new Date().toISOString();

    if (this.isSupabaseMode()) {
      try {
        // 1. Try Supabase Edge Function (handles DB insert + instant Telegram notification)
        const { data, error } = await this._supabase.functions.invoke("submit-quote", {
          body: {
            name,
            phone,
            whatsapp,
            category: (leadData.category || "Not sure").trim(),
            workTypes: Array.isArray(leadData.workTypes) ? leadData.workTypes : [],
            city: (leadData.city || "Muzaffarpur").trim(),
            locality: (leadData.locality || "").trim(),
            message: (leadData.message || "").trim(),
            referenceProject: (leadData.referenceProject || "").trim(),
            referenceImages: Array.isArray(leadData.referenceImages) ? leadData.referenceImages : [],
            preferredContact: leadData.preferredContact || "Either"
          }
        });

        if (!error && data && data.success) {
          console.log("Lead created via Supabase Edge Function (Telegram notified):", data);
          return { success: true, ...data };
        }

        // 2. Fallback to PostgreSQL stored procedure if Edge Function is unconfigured
        console.warn("Edge Function notice, falling back to direct RPC:", error?.message);
        const { data: rpcData, error: rpcError } = await this._supabase.rpc("submit_lead", {
          p_name: (leadData.name || "").trim(),
          p_phone: (leadData.phone || "").trim(),
          p_whatsapp: (leadData.whatsapp || leadData.phone || "").trim(),
          p_category: (leadData.category || "Not sure").trim(),
          p_work_types: Array.isArray(leadData.workTypes) ? leadData.workTypes : [],
          p_city: (leadData.city || "Muzaffarpur").trim(),
          p_locality: (leadData.locality || "").trim(),
          p_message: (leadData.message || "").trim(),
          p_reference_project: (leadData.referenceProject || "").trim(),
          p_reference_images: Array.isArray(leadData.referenceImages) ? leadData.referenceImages : [],
          p_preferred_contact: leadData.preferredContact || "Either"
        });

        if (rpcError) throw rpcError;
        console.log("Lead created via Supabase RPC fallback:", rpcData);
        return { success: true, ...rpcData };
      } catch (err) {
        console.error("Supabase error creating lead:", err);
      }
    }

    // Local / Demo Mode fallback
    const id = "lead_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    const cleanLead = {
      id,
      name: (leadData.name || "").trim(),
      phone: (leadData.phone || "").trim(),
      whatsapp: (leadData.whatsapp || leadData.phone || "").trim(),
      category: (leadData.category || "Not sure").trim(),
      workTypes: Array.isArray(leadData.workTypes) ? leadData.workTypes : [],
      city: (leadData.city || "Muzaffarpur").trim(),
      locality: (leadData.locality || "").trim(),
      message: (leadData.message || "").trim(),
      referenceProject: (leadData.referenceProject || "").trim(),
      referenceImages: Array.isArray(leadData.referenceImages) ? leadData.referenceImages : [],
      preferredContact: leadData.preferredContact || "Either",
      status: "new",
      source: "website",
      createdAt: now,
      updatedAt: now
    };
    await this._saveLocalLead(cleanLead);
    return cleanLead;
  },

  async getAllLeads() {
    await this.init();

    if (this.isSupabaseMode()) {
      try {
        const { data, error } = await this._supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        return (data || []).map((l) => ({
          id: l.id,
          name: l.name,
          phone: l.phone,
          whatsapp: l.whatsapp,
          category: l.category,
          workTypes: l.work_types || [],
          city: l.city,
          locality: l.locality,
          message: l.message,
          referenceProject: l.reference_project,
          referenceImages: l.reference_images || [],
          preferredContact: l.preferred_contact,
          status: l.status,
          source: l.source,
          createdAt: l.created_at,
          updatedAt: l.updated_at
        }));
      } catch (err) {
        console.error("Supabase error in getAllLeads:", err);
      }
    }

    return this._getLocalLeads();
  },

  async updateLeadStatus(id, newStatus) {
    await this.init();

    if (this.isSupabaseMode()) {
      try {
        const { error } = await this._supabase
          .from("leads")
          .update({ status: newStatus })
          .eq("id", id);

        if (error) throw error;
        return true;
      } catch (err) {
        console.error("Supabase error updating lead status:", err);
      }
    }

    const list = this._getLocalLeads();
    const lead = list.find((l) => l.id === id);
    if (lead) {
      lead.status = newStatus;
      lead.updatedAt = new Date().toISOString();
      await this._saveLocalLead(lead);
      return true;
    }
    return false;
  },

  async deleteLead(id) {
    await this.init();

    if (this.isSupabaseMode()) {
      try {
        const { error } = await this._supabase.from("leads").delete().eq("id", id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error("Supabase error deleting lead:", err);
      }
    }

    return this._deleteLocalLead(id);
  },

  // ── IndexedDB Local Mode Engine ──
  _idb: null,
  async _initIDB() {
    if (this._idb) return this._idb;
    return new Promise((resolve) => {
      const request = indexedDB.open("RS_Fabricator_Supabase_DB", 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("leads")) {
          db.createObjectStore("leads", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("images")) {
          db.createObjectStore("images", { keyPath: "id" });
        }
      };
      request.onsuccess = (e) => {
        this._idb = e.target.result;
        resolve(this._idb);
      };
      request.onerror = () => resolve(null);
    });
  },

  async _getLocalProjects(onlyPublished = false) {
    const seeds = typeof SEED_PROJECTS !== "undefined" && Array.isArray(SEED_PROJECTS) ? SEED_PROJECTS : [];
    
    const normalize = (items) => {
      return (items || []).map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        category: (p.category || "").toLowerCase(),
        shortDescription: p.shortDescription || p.short_description || "",
        description: p.description || "",
        location: p.location || "",
        year: p.year || "",
        services: p.services || "",
        featured: Boolean(p.featured === true || p.featured === "true" || p.featured === 1),
        published: Boolean(p.published === true || p.published === "true" || p.published === 1),
        coverImage: p.coverImage || p.cover_image || null,
        galleryImages: Array.isArray(p.galleryImages) ? p.galleryImages : (Array.isArray(p.project_images) ? p.project_images : []),
        createdAt: p.createdAt || p.created_at || new Date().toISOString(),
        updatedAt: p.updatedAt || p.updated_at || new Date().toISOString()
      }));
    };

    try {
      const idb = await this._initIDB();
      if (idb) {
        return new Promise((resolve) => {
          const tx = idb.transaction("projects", "readonly");
          const req = tx.objectStore("projects").getAll();
          req.onsuccess = () => {
            let list = req.result || [];
            if (list.length === 0 && seeds.length > 0) {
              list = seeds;
              // Seed IDB in background
              this._initIDB().then(db => {
                if (db) {
                  const seedTx = db.transaction("projects", "readwrite");
                  seeds.forEach(s => seedTx.objectStore("projects").put(s));
                }
              });
            }
            let normalized = normalize(list);
            if (onlyPublished) normalized = normalized.filter((p) => p.published === true);
            resolve(normalized);
          };
          req.onerror = () => {
            let fb = this._getLocalStorageFallback("rs_local_projects_backup", onlyPublished);
            let normalized = normalize(fb.length > 0 ? fb : seeds);
            if (onlyPublished) normalized = normalized.filter((p) => p.published === true);
            resolve(normalized);
          };
        });
      }
    } catch (e) {}
    let fallback = this._getLocalStorageFallback("rs_local_projects_backup", onlyPublished);
    let normalized = normalize(fallback.length > 0 ? fallback : seeds);
    if (onlyPublished) normalized = normalized.filter((p) => p.published === true);
    return normalized;
  },

  async _saveLocalProject(project) {
    try {
      const idb = await this._initIDB();
      if (idb) {
        await new Promise((resolve, reject) => {
          const tx = idb.transaction("projects", "readwrite");
          tx.objectStore("projects").put(project);
          tx.oncomplete = resolve;
          tx.onerror = reject;
        });
      }
    } catch (e) {}

    try {
      const list = this._getLocalStorageFallback("rs_local_projects_backup");
      const idx = list.findIndex((p) => p.id === project.id);
      if (idx >= 0) list[idx] = project;
      else list.unshift(project);
      localStorage.setItem("rs_local_projects_backup", JSON.stringify(list));
    } catch (e) {}
  },

  async _deleteLocalProject(id) {
    try {
      const idb = await this._initIDB();
      if (idb) {
        await new Promise((resolve) => {
          const tx = idb.transaction("projects", "readwrite");
          tx.objectStore("projects").delete(id);
          tx.oncomplete = resolve;
        });
      }
    } catch (e) {}

    try {
      const list = this._getLocalStorageFallback("rs_local_projects_backup").filter((p) => p.id !== id);
      localStorage.setItem("rs_local_projects_backup", JSON.stringify(list));
    } catch (e) {}
    return true;
  },

  async _getLocalLeads() {
    try {
      const idb = await this._initIDB();
      if (idb && idb.objectStoreNames.contains("leads")) {
        return new Promise((resolve) => {
          const tx = idb.transaction("leads", "readonly");
          const req = tx.objectStore("leads").getAll();
          req.onsuccess = () => {
            const list = req.result || [];
            list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            resolve(list);
          };
          req.onerror = () => resolve(this._getLocalStorageFallback("rs_local_leads_backup"));
        });
      }
    } catch (e) {}
    return this._getLocalStorageFallback("rs_local_leads_backup");
  },

  async _saveLocalLead(lead) {
    try {
      const idb = await this._initIDB();
      if (idb && idb.objectStoreNames.contains("leads")) {
        await new Promise((resolve, reject) => {
          const tx = idb.transaction("leads", "readwrite");
          tx.objectStore("leads").put(lead);
          tx.oncomplete = resolve;
          tx.onerror = reject;
        });
      }
    } catch (e) {}

    try {
      const list = this._getLocalStorageFallback("rs_local_leads_backup");
      const idx = list.findIndex((l) => l.id === lead.id);
      if (idx >= 0) list[idx] = lead;
      else list.unshift(lead);
      localStorage.setItem("rs_local_leads_backup", JSON.stringify(list));
    } catch (e) {}
  },

  async _deleteLocalLead(id) {
    try {
      const idb = await this._initIDB();
      if (idb && idb.objectStoreNames.contains("leads")) {
        await new Promise((resolve) => {
          const tx = idb.transaction("leads", "readwrite");
          tx.objectStore("leads").delete(id);
          tx.oncomplete = resolve;
        });
      }
    } catch (e) {}

    try {
      const list = this._getLocalStorageFallback("rs_local_leads_backup").filter((l) => l.id !== id);
      localStorage.setItem("rs_local_leads_backup", JSON.stringify(list));
    } catch (e) {}
    return true;
  },

  _getLocalStorageFallback(key, onlyPublished = false) {
    try {
      const raw = localStorage.getItem(key);
      let list = raw ? JSON.parse(raw) : [];
      if (onlyPublished) list = list.filter((p) => p.published === true);
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return list;
    } catch (e) {
      return [];
    }
  }
};

// ── Supabase Admin Authentication Handler ──
const AdminAuth = {
  currentUser: null,
  userProfile: null,

  async init() {
    await DB.init();
    if (DB.isSupabaseMode() && DB._supabase) {
      const { data: { session } } = await DB._supabase.auth.getSession();
      if (session?.user) {
        this.currentUser = session.user;
        await this._fetchUserProfile();
      } else {
        this.currentUser = null;
        this.userProfile = null;
      }

      // Listen for auth state changes
      DB._supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          this.currentUser = session.user;
          await this._fetchUserProfile();
        } else {
          this.currentUser = null;
          this.userProfile = null;
        }
      });

      return this.currentUser;
    } else {
      const demoAuth = sessionStorage.getItem(LOCAL_STORAGE_SESSION_KEY) === "true";
      this.currentUser = demoAuth ? { email: "admin@riddhisiddhi.local", isDemo: true } : null;
      this.userProfile = demoAuth ? { role: "admin" } : null;
      return this.currentUser;
    }
  },

  async _fetchUserProfile() {
    if (!this.currentUser || !DB._supabase) return;
    try {
      const { data, error } = await DB._supabase
        .from("profiles")
        .select("role")
        .eq("id", this.currentUser.id)
        .maybeSingle();

      if (!error && data) {
        this.userProfile = data;
      } else {
        this.userProfile = { role: "user" };
      }
    } catch (e) {
      this.userProfile = { role: "user" };
    }
  },

  isAuthenticated() {
    return Boolean(this.currentUser);
  },

  isAdmin() {
    if (this.currentUser?.isDemo) return true;
    if (this.userProfile?.role) return this.userProfile.role === "admin";
    return Boolean(this.currentUser);
  },

  async signUp(email, password) {
    await DB.init();
    if (DB.isSupabaseMode() && DB._supabase) {
      const { data, error } = await DB._supabase.auth.signUp({
        email: email.trim(),
        password: password
      });

      if (error) throw error;

      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error("An account with this email already exists. Please click 'Sign In' with your password.");
      }

      if (data.session?.user) {
        this.currentUser = data.session.user;
        await this._fetchUserProfile();
        return { success: true, autoLogin: true, user: this.currentUser };
      } else {
        return {
          success: true,
          autoLogin: false,
          needsConfirmation: true,
          message: "Account registered! If 'Confirm Email' is enabled in your Supabase Auth settings, please check your inbox to confirm your email, or disable email confirmation in Supabase Dashboard -> Authentication -> Providers -> Email."
        };
      }
    } else {
      if (email && password) {
        sessionStorage.setItem(LOCAL_STORAGE_SESSION_KEY, "true");
        this.currentUser = { email, isDemo: true };
        this.userProfile = { role: "admin" };
        return { success: true, autoLogin: true, user: this.currentUser };
      }
      throw new Error("Please enter both email and password.");
    }
  },

  async login(email, password) {
    await DB.init();
    if (DB.isSupabaseMode() && DB._supabase) {
      const { data, error } = await DB._supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) throw error;
      this.currentUser = data.user;
      await this._fetchUserProfile();
      return this.currentUser;
    } else {
      if (email && password) {
        sessionStorage.setItem(LOCAL_STORAGE_SESSION_KEY, "true");
        this.currentUser = { email, isDemo: true };
        this.userProfile = { role: "admin" };
        return this.currentUser;
      }
      throw new Error("Please enter both email and password.");
    }
  },

  async logout() {
    if (DB.isSupabaseMode() && DB._supabase) {
      await DB._supabase.auth.signOut();
    }
    sessionStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    this.currentUser = null;
    this.userProfile = null;
  },

  async testTelegramAlert() {
    await DB.init();
    if (DB.isSupabaseMode() && DB._supabase) {
      const { data, error } = await DB._supabase.functions.invoke("submit-quote", {
        body: { action: "test_telegram" }
      });
      if (error) throw error;
      return data;
    }
    throw new Error("Demo mode: Telegram test requires Supabase connection.");
  }
};

AdminAuth.signup = AdminAuth.signUp;
AdminAuth.signIn = AdminAuth.login;

window.RS_DB = DB;
window.RS_Auth = AdminAuth;
