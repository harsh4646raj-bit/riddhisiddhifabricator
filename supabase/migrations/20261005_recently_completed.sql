-- Add columns for Recently Completed if not exists
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS is_recently_completed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS recently_completed_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient querying of recently completed projects
CREATE INDEX IF NOT EXISTS idx_projects_recently_completed 
ON public.projects (is_recently_completed, recently_completed_at DESC);

-- Trigger function to enforce FIFO queue (max 4) and timestamp tracking
CREATE OR REPLACE FUNCTION public.enforce_recently_completed_fifo()
RETURNS TRIGGER AS $$
DECLARE
  active_count INTEGER;
  oldest_id UUID;
BEGIN
  -- Handle timestamp logic
  IF NEW.is_recently_completed = TRUE THEN
    IF TG_OP = 'INSERT' OR OLD.is_recently_completed IS NOT TRUE THEN
      NEW.recently_completed_at := NOW();
    ELSE
      NEW.recently_completed_at := COALESCE(OLD.recently_completed_at, NOW());
    END IF;

    -- Count other active recently completed projects
    SELECT COUNT(*) INTO active_count
    FROM public.projects
    WHERE is_recently_completed = TRUE 
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

    -- If 4 or more other projects are recently completed, demote the oldest one(s)
    WHILE active_count >= 4 LOOP
      SELECT id INTO oldest_id
      FROM public.projects
      WHERE is_recently_completed = TRUE 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      ORDER BY recently_completed_at ASC NULLS FIRST, created_at ASC
      LIMIT 1;

      IF oldest_id IS NOT NULL THEN
        UPDATE public.projects
        SET is_recently_completed = FALSE, recently_completed_at = NULL
        WHERE id = oldest_id;
        
        active_count := active_count - 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;

  ELSE
    NEW.recently_completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recently_completed_fifo ON public.projects;
CREATE TRIGGER trg_recently_completed_fifo
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_recently_completed_fifo();
