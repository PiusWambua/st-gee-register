-- St. George's Digital Register: safe schema compatibility migration.
-- Run once in Supabase SQL Editor before deploying this version.

DO $$
BEGIN
  -- Learner name: the application now uses full_name everywhere.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learners' AND column_name='name')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learners' AND column_name='full_name') THEN
    ALTER TABLE public.learners RENAME COLUMN name TO full_name;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learners' AND column_name='full_name') THEN
    ALTER TABLE public.learners ADD COLUMN full_name text;
  END IF;

  -- Admission number: support older adm_number databases.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learners' AND column_name='admission_no') THEN
    ALTER TABLE public.learners ADD COLUMN admission_no text;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learners' AND column_name='adm_number') THEN
      EXECUTE 'UPDATE public.learners SET admission_no = NULLIF(adm_number::text, '''') WHERE admission_no IS NULL';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learners' AND column_name='nemis_no') THEN
    ALTER TABLE public.learners ADD COLUMN nemis_no text;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learners' AND column_name='upi_no') THEN
      EXECUTE 'UPDATE public.learners SET nemis_no = NULLIF(upi_no::text, '''') WHERE nemis_no IS NULL';
    END IF;
  END IF;

  ALTER TABLE public.learners ADD COLUMN IF NOT EXISTS gender text;
  ALTER TABLE public.learners ADD COLUMN IF NOT EXISTS residence text DEFAULT 'Day Scholar';
  ALTER TABLE public.learners ADD COLUMN IF NOT EXISTS section text;
  ALTER TABLE public.learners ADD COLUMN IF NOT EXISTS grade text;
  ALTER TABLE public.learners ADD COLUMN IF NOT EXISTS stream text;
  ALTER TABLE public.learners ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_name text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS section text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS grade text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stream text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
END $$;

-- If an older database has both columns, fill the new canonical columns from the old ones.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learners' AND column_name='name')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learners' AND column_name='full_name') THEN
    EXECUTE 'UPDATE public.learners SET full_name = NULLIF(name::text, '''') WHERE (full_name IS NULL OR btrim(full_name::text)='''') AND name IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learners' AND column_name='adm_number') THEN
    EXECUTE 'UPDATE public.learners SET admission_no = NULLIF(adm_number::text, '''') WHERE (admission_no IS NULL OR btrim(admission_no::text)='''') AND adm_number IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learners' AND column_name='upi_no') THEN
    EXECUTE 'UPDATE public.learners SET nemis_no = NULLIF(upi_no::text, '''') WHERE (nemis_no IS NULL OR btrim(nemis_no::text)='''') AND upi_no IS NOT NULL';
  END IF;
END $$;

UPDATE public.learners SET full_name = COALESCE(NULLIF(full_name,''), 'Unnamed Learner') WHERE full_name IS NULL;
UPDATE public.learners SET residence='Day Scholar' WHERE residence IS NULL OR residence NOT IN ('Boarder','Day Scholar');
UPDATE public.profiles SET active=true WHERE active IS NULL;

-- Present/Absent only. Remove any old attendance status check and replace it.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.attendance'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%status%' LOOP
    EXECUTE format('ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_present_absent;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_present_absent CHECK (status IN ('Present','Absent'));


DROP FUNCTION IF EXISTS public.current_role();
CREATE OR REPLACE FUNCTION public.current_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT role FROM public.profiles WHERE id=auth.uid() AND active=true $$;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin' AND active=true) $$;
CREATE OR REPLACE FUNCTION public.teacher_can_access(learner_grade text, learner_stream text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='teacher' AND p.active=true AND p.grade=learner_grade AND coalesce(p.stream,'')=coalesce(learner_stream,'')) $$;

-- Refresh RLS policies for the current Admin/Class Teacher model.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles read self or admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles update self or admin" ON public.profiles;
DROP POLICY IF EXISTS "admin insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "learners read by role" ON public.learners;
DROP POLICY IF EXISTS "learners insert by role" ON public.learners;
DROP POLICY IF EXISTS "learners update by role" ON public.learners;
DROP POLICY IF EXISTS "learners delete by role" ON public.learners;
DROP POLICY IF EXISTS "attendance read by role" ON public.attendance;
DROP POLICY IF EXISTS "attendance insert by role" ON public.attendance;
DROP POLICY IF EXISTS "attendance update by role" ON public.attendance;
DROP POLICY IF EXISTS "attendance delete by role" ON public.attendance;
DROP POLICY IF EXISTS "classes read" ON public.classes;
DROP POLICY IF EXISTS "admins manage classes" ON public.classes;
CREATE POLICY "profiles read self or admin" ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid() OR public.is_admin());
CREATE POLICY "profiles update self or admin" ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid() OR public.is_admin()) WITH CHECK (id=auth.uid() OR public.is_admin());
CREATE POLICY "admin insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "learners read by role" ON public.learners FOR SELECT TO authenticated USING (public.is_admin() OR public.teacher_can_access(grade,stream));
CREATE POLICY "learners insert by role" ON public.learners FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.teacher_can_access(grade,stream));
CREATE POLICY "learners update by role" ON public.learners FOR UPDATE TO authenticated USING (public.is_admin() OR public.teacher_can_access(grade,stream)) WITH CHECK (public.is_admin() OR public.teacher_can_access(grade,stream));
CREATE POLICY "learners delete by role" ON public.learners FOR DELETE TO authenticated USING (public.is_admin() OR public.teacher_can_access(grade,stream));
CREATE POLICY "attendance read by role" ON public.attendance FOR SELECT TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.learners l WHERE l.id=learner_id AND public.teacher_can_access(l.grade,l.stream)));
CREATE POLICY "attendance insert by role" ON public.attendance FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.learners l WHERE l.id=learner_id AND public.teacher_can_access(l.grade,l.stream)));
CREATE POLICY "attendance update by role" ON public.attendance FOR UPDATE TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.learners l WHERE l.id=learner_id AND public.teacher_can_access(l.grade,l.stream))) WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.learners l WHERE l.id=learner_id AND public.teacher_can_access(l.grade,l.stream)));
CREATE POLICY "attendance delete by role" ON public.attendance FOR DELETE TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.learners l WHERE l.id=learner_id AND public.teacher_can_access(l.grade,l.stream)));
CREATE POLICY "classes read" ON public.classes FOR SELECT TO authenticated USING (public.is_admin() OR public.current_role()='teacher');
CREATE POLICY "admins manage classes" ON public.classes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE UNIQUE INDEX IF NOT EXISTS attendance_learner_date_unique ON public.attendance(learner_id, attendance_date);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_login_name_unique ON public.profiles(lower(login_name)) WHERE login_name IS NOT NULL AND btrim(login_name) <> '';
NOTIFY pgrst, 'reload schema';
