-- ============================================================================
-- RIDDHI SIDDHI FABRICATOR — SEO PHASE 1.4: CANONICAL SLUG RECONCILIATION
-- ============================================================================
-- Migration File: supabase/migrations/20261006_reconcile_canonical_slugs.sql
-- Date: 2026-10-06
-- Target Table: public.projects
-- Purpose:
--   Synchronize live Supabase project slugs with the 16 factual canonical SEO
--   slugs used by SEED_PROJECTS and sitemap.xml.
--
-- RECONCILIATION SUMMARY:
-- ----------------------------------------------------------------------------
-- - Total Seed Projects: 16
-- - Deterministically Matched Supabase Production Rows: 13
-- - Bathroom Door Row (e87af5eb-1c2d-4c66-83e4-e3d287a2e7be):
--     Already has factual slug 'white-upvc-bathroom-doors' in production Supabase.
--     Requires NO UPDATE statement.
-- - Active UPDATE Operations: EXACTLY 12 statements.
-- - Extra Supabase Rows: 5 (Standalone variants; untouched, retained in database).
-- - Seed-Only Projects: 3 (Fabrication catalogue projects; served safely via fallback, not inserted into Supabase).
--
-- VERIFIED DETERMINISTIC MAPPING TABLE:
-- ----------------------------------------------------------------------------
-- #  | Supabase UUID                        | Old Database Slug                                  | Target Canonical Slug                          | Category  | Seed ID
-- ----------------------------------------------------------------------------
-- 1  | 4d304d74-eafc-4d86-81cb-511b32e90fda | white-upvc-3-panel-casement-window                 | residential-upvc-casement-privacy-windows      | upvc      | proj-upvc-02
-- 2  | 97d28792-6720-454a-a507-8a42c99c536b | large-upvc-balcony-sliding-glass-door              | high-aperture-upvc-sliding-patio-doors         | upvc      | proj-upvc-03
-- 3  | cfe43355-3b31-4998-9c75-9c82a6d5e8b3 | white-upvc-sliding-window-with-integrated-grill    | conch-fenstech-white-upvc-sliding-windows      | upvc      | proj-upvc-01
-- -- | e87af5eb-1c2d-4c66-83e4-e3d287a2e7be | white-upvc-bathroom-doors                          | white-upvc-bathroom-doors [ALREADY IDENTICAL]   | upvc      | proj-upvc-04
-- 4  | b2d15cec-5014-4be2-96e5-184886736713 | stepped-arch-aluminium-window-with-geometric-grill | stepped-arch-window-sunburst-security-grill    | aluminium | proj-alum-01
-- 5  | 72e8c078-c56c-4420-aef2-09aa2698d055 | arched-aluminium-balcony-sliding-window            | large-panoramic-arched-aluminium-sliding-window| aluminium | proj-alum-02
-- 6  | 2d679255-66e7-4dcb-b662-2b24bd3095b2 | bronze-finish-aluminium-sliding-windows            | bronze-anodized-aluminium-sliding-windows      | aluminium | proj-alum-03
-- 7  | f413b280-9765-4079-ba7f-dc90720a3f48 | designer-acp-aluminium-doors                       | designer-acp-aluminium-doors-partitions        | aluminium | proj-alum-04
-- 8  | 29d70c13-609a-4b88-8a30-a18ad3b666f2 | stainless-steel-designer-main-door                 | ss-security-doors-safety-enclosures            | steel     | proj-steel-04
-- 9  | 4327bdbb-5bb7-45ef-8f55-14f9eb1f49d5 | stainless-steel-staircase-balcony-railing          | exterior-terrace-balcony-ss-railings           | steel     | proj-steel-07
-- 10 | f919313c-3fab-45a0-a143-d1c38494c91c | stainless-steel-vertical-picket-staircase-railing  | architectural-ss-staircase-railing-systems     | steel     | proj-steel-05
-- 11 | 5fd47230-a1df-4948-8936-5161d1b67cbe | premium-stainless-steel-staircase-railings         | crystal-acrylic-pillar-ss-railings             | steel     | proj-steel-06
-- 12 | 036bd314-8874-4155-8f5a-c338caf0834e | stainless-steel-entrance-gate-collection           | grand-residential-high-span-ss-gate            | steel     | proj-steel-03
--
-- UNTOUCHED EXTRA SUPABASE ROWS (5 rows preserved):
-- ----------------------------------------------------------------------------
-- - 2b33d886-7ee5-4cd4-bfee-fcec042aa684 (upvc): upvc-sliding-window-with-mosquito-mesh
-- - af0ba5f8-8916-4e04-9440-fd5152a1a216 (aluminium): decorative-acp-aluminium-doors
-- - f09d9a98-1ac1-4ccc-a485-452042e3b57b (aluminium): modern-black-aluminium-frosted-glass-door
-- - 43a2da93-4034-4544-ac40-1273624ba668 (aluminium): wood-finish-aluminium-bathroom-utility-doors
-- - 276105e1-9b6d-4e2e-8943-f85f0ed9af8f (steel): stainless-steel-balcony-railing
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. uPVC Projects (3 updates; bathroom door e87af5eb... already matches)
-- ----------------------------------------------------------------------------
UPDATE public.projects
SET slug = 'residential-upvc-casement-privacy-windows',
    updated_at = NOW()
WHERE id = '4d304d74-eafc-4d86-81cb-511b32e90fda'
  AND category = 'upvc';

UPDATE public.projects
SET slug = 'high-aperture-upvc-sliding-patio-doors',
    updated_at = NOW()
WHERE id = '97d28792-6720-454a-a507-8a42c99c536b'
  AND category = 'upvc';

UPDATE public.projects
SET slug = 'conch-fenstech-white-upvc-sliding-windows',
    updated_at = NOW()
WHERE id = 'cfe43355-3b31-4998-9c75-9c82a6d5e8b3'
  AND category = 'upvc';


-- ----------------------------------------------------------------------------
-- 2. Aluminium Projects (4 updates)
-- ----------------------------------------------------------------------------
UPDATE public.projects
SET slug = 'stepped-arch-window-sunburst-security-grill',
    updated_at = NOW()
WHERE id = 'b2d15cec-5014-4be2-96e5-184886736713'
  AND category = 'aluminium';

UPDATE public.projects
SET slug = 'large-panoramic-arched-aluminium-sliding-window',
    updated_at = NOW()
WHERE id = '72e8c078-c56c-4420-aef2-09aa2698d055'
  AND category = 'aluminium';

UPDATE public.projects
SET slug = 'bronze-anodized-aluminium-sliding-windows',
    updated_at = NOW()
WHERE id = '2d679255-66e7-4dcb-b662-2b24bd3095b2'
  AND category = 'aluminium';

UPDATE public.projects
SET slug = 'designer-acp-aluminium-doors-partitions',
    updated_at = NOW()
WHERE id = 'f413b280-9765-4079-ba7f-dc90720a3f48'
  AND category = 'aluminium';


-- ----------------------------------------------------------------------------
-- 3. Steel Projects (5 updates)
-- ----------------------------------------------------------------------------
UPDATE public.projects
SET slug = 'ss-security-doors-safety-enclosures',
    updated_at = NOW()
WHERE id = '29d70c13-609a-4b88-8a30-a18ad3b666f2'
  AND category = 'steel';

UPDATE public.projects
SET slug = 'exterior-terrace-balcony-ss-railings',
    updated_at = NOW()
WHERE id = '4327bdbb-5bb7-45ef-8f55-14f9eb1f49d5'
  AND category = 'steel';

UPDATE public.projects
SET slug = 'architectural-ss-staircase-railing-systems',
    updated_at = NOW()
WHERE id = 'f919313c-3fab-45a0-a143-d1c38494c91c'
  AND category = 'steel';

UPDATE public.projects
SET slug = 'crystal-acrylic-pillar-ss-railings',
    updated_at = NOW()
WHERE id = '5fd47230-a1df-4948-8936-5161d1b67cbe'
  AND category = 'steel';

UPDATE public.projects
SET slug = 'grand-residential-high-span-ss-gate',
    updated_at = NOW()
WHERE id = '036bd314-8874-4155-8f5a-c338caf0834e'
  AND category = 'steel';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERY (READ-ONLY)
-- Run this in the Supabase SQL editor after execution to confirm the new slug state:
-- ============================================================================
-- SELECT id, category, slug, name, updated_at
-- FROM public.projects
-- WHERE id IN (
--   '4d304d74-eafc-4d86-81cb-511b32e90fda',
--   '97d28792-6720-454a-a507-8a42c99c536b',
--   'cfe43355-3b31-4998-9c75-9c82a6d5e8b3',
--   'e87af5eb-1c2d-4c66-83e4-e3d287a2e7be',
--   'b2d15cec-5014-4be2-96e5-184886736713',
--   '72e8c078-c56c-4420-aef2-09aa2698d055',
--   '2d679255-66e7-4dcb-b662-2b24bd3095b2',
--   'f413b280-9765-4079-ba7f-dc90720a3f48',
--   '29d70c13-609a-4b88-8a30-a18ad3b666f2',
--   '4327bdbb-5bb7-45ef-8f55-14f9eb1f49d5',
--   'f919313c-3fab-45a0-a143-d1c38494c91c',
--   '5fd47230-a1df-4948-8936-5161d1b67cbe',
--   '036bd314-8874-4155-8f5a-c338caf0834e'
-- )
-- ORDER BY category, slug;

-- ============================================================================
-- ROLLBACK SCRIPT (IF EVER REQUIRED)
-- ============================================================================
-- BEGIN;
-- UPDATE public.projects SET slug = 'white-upvc-3-panel-casement-window', updated_at = NOW() WHERE id = '4d304d74-eafc-4d86-81cb-511b32e90fda' AND category = 'upvc';
-- UPDATE public.projects SET slug = 'large-upvc-balcony-sliding-glass-door', updated_at = NOW() WHERE id = '97d28792-6720-454a-a507-8a42c99c536b' AND category = 'upvc';
-- UPDATE public.projects SET slug = 'white-upvc-sliding-window-with-integrated-grill', updated_at = NOW() WHERE id = 'cfe43355-3b31-4998-9c75-9c82a6d5e8b3' AND category = 'upvc';
-- UPDATE public.projects SET slug = 'stepped-arch-aluminium-window-with-geometric-grill', updated_at = NOW() WHERE id = 'b2d15cec-5014-4be2-96e5-184886736713' AND category = 'aluminium';
-- UPDATE public.projects SET slug = 'arched-aluminium-balcony-sliding-window', updated_at = NOW() WHERE id = '72e8c078-c56c-4420-aef2-09aa2698d055' AND category = 'aluminium';
-- UPDATE public.projects SET slug = 'bronze-finish-aluminium-sliding-windows', updated_at = NOW() WHERE id = '2d679255-66e7-4dcb-b662-2b24bd3095b2' AND category = 'aluminium';
-- UPDATE public.projects SET slug = 'designer-acp-aluminium-doors', updated_at = NOW() WHERE id = 'f413b280-9765-4079-ba7f-dc90720a3f48' AND category = 'aluminium';
-- UPDATE public.projects SET slug = 'stainless-steel-designer-main-door', updated_at = NOW() WHERE id = '29d70c13-609a-4b88-8a30-a18ad3b666f2' AND category = 'steel';
-- UPDATE public.projects SET slug = 'stainless-steel-staircase-balcony-railing', updated_at = NOW() WHERE id = '4327bdbb-5bb7-45ef-8f55-14f9eb1f49d5' AND category = 'steel';
-- UPDATE public.projects SET slug = 'stainless-steel-vertical-picket-staircase-railing', updated_at = NOW() WHERE id = 'f919313c-3fab-45a0-a143-d1c38494c91c' AND category = 'steel';
-- UPDATE public.projects SET slug = 'premium-stainless-steel-staircase-railings', updated_at = NOW() WHERE id = '5fd47230-a1df-4948-8936-5161d1b67cbe' AND category = 'steel';
-- UPDATE public.projects SET slug = 'stainless-steel-entrance-gate-collection', updated_at = NOW() WHERE id = '036bd314-8874-4155-8f5a-c338caf0834e' AND category = 'steel';
-- COMMIT;
