-- ============================================================================
-- RIDDHI SIDDHI FABRICATOR — PRODUCTION SUPABASE POSTGRESQL SCHEMA & SECURITY
-- ============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles Table & Admin Authorization
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'staff', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Security-Definer function to check if current user is an Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Security-Definer function to check if current user is Staff or Admin
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Automatic Profile Creation Trigger on Auth Sign-Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  -- If this is the very first registered user, designate as 'admin', otherwise 'user'
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;
  
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN is_first_user THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('aluminium', 'upvc', 'steel')),
  cover_image JSONB DEFAULT NULL, -- Cached view of primary cover image { public_id, secure_url, thumbnail_url }
  short_description TEXT DEFAULT '',
  description TEXT DEFAULT '',
  location TEXT DEFAULT '',
  year TEXT DEFAULT '',
  services TEXT DEFAULT '',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  published BOOLEAN NOT NULL DEFAULT FALSE, -- Default FALSE: must be explicitly published by Admin
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_category_slug UNIQUE (category, slug)
);

-- 5. Project Images Table (Source of Truth for Media)
CREATE TABLE IF NOT EXISTS public.project_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL,
  secure_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  alt_text TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Leads / Enquiry Table
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Not sure',
  work_types TEXT[] DEFAULT '{}',
  city TEXT NOT NULL DEFAULT 'Muzaffarpur',
  locality TEXT DEFAULT '',
  message TEXT DEFAULT '',
  reference_project TEXT DEFAULT '',
  reference_images JSONB DEFAULT '[]'::jsonb,
  preferred_contact TEXT NOT NULL DEFAULT 'Either' CHECK (preferred_contact IN ('Phone Call', 'WhatsApp', 'Either')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'quotation_sent', 'won', 'lost')),
  source TEXT NOT NULL DEFAULT 'website',
  telegram_notification_sent BOOLEAN DEFAULT FALSE,
  telegram_notification_sent_at TIMESTAMPTZ,
  telegram_notification_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist if table was already created
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS telegram_notification_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS telegram_notification_sent_at TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS telegram_notification_error TEXT;

-- 7. Automatic updated_at Trigger Function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_projects_updated_at ON public.projects;
CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_leads_updated_at ON public.leads;
CREATE TRIGGER trigger_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. Synchronize Cover Image View
CREATE OR REPLACE FUNCTION public.sync_project_cover()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_cover = TRUE THEN
    -- Unset previous cover images for this project
    UPDATE public.project_images
    SET is_cover = FALSE
    WHERE project_id = NEW.project_id AND id <> NEW.id;

    -- Update parent project cover_image cache
    UPDATE public.projects
    SET cover_image = jsonb_build_object(
      'public_id', NEW.public_id,
      'secure_url', NEW.secure_url,
      'thumbnail_url', NEW.thumbnail_url
    )
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_project_cover ON public.project_images;
CREATE TRIGGER trigger_sync_project_cover
  AFTER INSERT OR UPDATE OF is_cover ON public.project_images
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_cover();

-- 9. Database Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_projects_cat_pub ON public.projects(category, published);
CREATE INDEX IF NOT EXISTS idx_projects_cat_slug ON public.projects(category, slug);
CREATE INDEX IF NOT EXISTS idx_proj_images_proj_sort ON public.project_images(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_leads_status_created ON public.leads(status, created_at DESC);

-- 10. Secure Stored Procedure for Public Lead Submissions
CREATE OR REPLACE FUNCTION public.submit_lead(
  p_name TEXT,
  p_phone TEXT,
  p_whatsapp TEXT DEFAULT '',
  p_category TEXT DEFAULT 'Not sure',
  p_work_types TEXT[] DEFAULT '{}',
  p_city TEXT DEFAULT 'Muzaffarpur',
  p_locality TEXT DEFAULT '',
  p_message TEXT DEFAULT '',
  p_reference_project TEXT DEFAULT '',
  p_reference_images JSONB DEFAULT '[]'::jsonb,
  p_preferred_contact TEXT DEFAULT 'Either'
)
RETURNS JSONB AS $$
DECLARE
  v_lead_id UUID;
  v_res JSONB;
BEGIN
  -- Validate required fields
  IF TRIM(p_name) = '' OR TRIM(p_phone) = '' THEN
    RAISE EXCEPTION 'Name and Phone Number are required.';
  END IF;

  -- Validate minimum 10 digits on phone number
  IF LENGTH(REGEXP_REPLACE(TRIM(p_phone), '[^\d]', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Phone number must contain at least 10 digits.';
  END IF;

  -- Validate minimum 10 digits on whatsapp number if provided
  IF TRIM(p_whatsapp) <> '' AND LENGTH(REGEXP_REPLACE(TRIM(p_whatsapp), '[^\d]', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'WhatsApp number must contain at least 10 digits.';
  END IF;

  -- Insert lead with forced server-controlled metadata
  INSERT INTO public.leads (
    name,
    phone,
    whatsapp,
    category,
    work_types,
    city,
    locality,
    message,
    reference_project,
    reference_images,
    preferred_contact,
    status,
    source,
    created_at,
    updated_at
  ) VALUES (
    TRIM(p_name),
    TRIM(p_phone),
    COALESCE(NULLIF(TRIM(p_whatsapp), ''), TRIM(p_phone)),
    COALESCE(NULLIF(TRIM(p_category), ''), 'Not sure'),
    p_work_types,
    COALESCE(NULLIF(TRIM(p_city), ''), 'Muzaffarpur'),
    TRIM(p_locality),
    TRIM(p_message),
    TRIM(p_reference_project),
    COALESCE(p_reference_images, '[]'::jsonb),
    CASE WHEN p_preferred_contact IN ('Phone Call', 'WhatsApp', 'Either') THEN p_preferred_contact ELSE 'Either' END,
    'new',     -- Forced server-controlled status
    'website', -- Forced server-controlled source
    NOW(),
    NOW()
  ) RETURNING id INTO v_lead_id;

  SELECT jsonb_build_object('success', TRUE, 'id', v_lead_id) INTO v_res;
  RETURN v_res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant public execute permission to submit_lead RPC
GRANT EXECUTE ON FUNCTION public.submit_lead TO anon, authenticated;

-- ============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- ── PROFILES POLICIES ──
-- Users can read their own profile; Admins can read all profiles
DROP POLICY IF EXISTS "Read own profile" ON public.profiles;
CREATE POLICY "Read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Users CANNOT modify their own role; Only Admins can update profiles
DROP POLICY IF EXISTS "Admin update profiles" ON public.profiles;
CREATE POLICY "Admin update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── PROJECTS POLICIES ──
-- Public can SELECT published projects only
DROP POLICY IF EXISTS "Public read published projects" ON public.projects;
CREATE POLICY "Public read published projects" ON public.projects
  FOR SELECT TO anon, authenticated
  USING (published = true);

-- Admins have full SELECT, INSERT, UPDATE, DELETE access
DROP POLICY IF EXISTS "Admin manage projects" ON public.projects;
CREATE POLICY "Admin manage projects" ON public.projects
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── PROJECT IMAGES POLICIES ──
-- Public can only view images belonging to PUBLISHED projects
DROP POLICY IF EXISTS "Public read published project images" ON public.project_images;
CREATE POLICY "Public read published project images" ON public.project_images
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_images.project_id
        AND projects.published = true
    )
  );

-- Admins have full access to all project images
DROP POLICY IF EXISTS "Admin manage project images" ON public.project_images;
CREATE POLICY "Admin manage project images" ON public.project_images
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── LEADS POLICIES ──
-- Public users CANNOT SELECT, UPDATE, or DELETE leads (leads submitted securely via submit_lead RPC)
-- Admins have full management access to leads
DROP POLICY IF EXISTS "Admin manage leads" ON public.leads;
CREATE POLICY "Admin manage leads" ON public.leads
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
