-- ============================================================
--  SIMEC Service Reports – Add equipment_data JSONB column
--  Stores equipment-specific data (UPS measurements, AC checklists, etc.)
-- ============================================================

ALTER TABLE public.service_reports
ADD COLUMN IF NOT EXISTS equipment_data jsonb DEFAULT '{}';

COMMENT ON COLUMN public.service_reports.equipment_data IS
  'JSONB column storing equipment-specific data. Structure varies by equipment_type (ups/ac).';
