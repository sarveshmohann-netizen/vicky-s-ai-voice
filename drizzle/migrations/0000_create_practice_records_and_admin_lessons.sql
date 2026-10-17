CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
CREATE FUNCTION public.valid_practice_grade(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT jsonb_typeof(value) = 'object'
 AND value ?& ARRAY['evidence', 'clarity', 'accuracy', 'ownership']
 AND NOT EXISTS (
   SELECT 1 FROM unnest(ARRAY['evidence', 'clarity', 'accuracy', 'ownership']) AS k
   WHERE CASE WHEN jsonb_typeof(value -> k) = 'number'
     THEN (value ->> k)::numeric NOT BETWEEN 0 AND 4
     ELSE true END
 )
$$;
CREATE TABLE public.practice_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id uuid NOT NULL DEFAULT auth.uid(),
  question_id text NOT NULL,
  topic text NOT NULL,
  grade jsonb NOT NULL CHECK (public.valid_practice_grade(grade)),
  coaching_note text NOT NULL DEFAULT '',
  improved_answer text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_records TO authenticated;
GRANT ALL ON public.practice_records TO service_role;
ALTER TABLE public.practice_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders read own practice" ON public.practice_records FOR SELECT TO authenticated USING (founder_id = auth.uid());
CREATE POLICY "Founders add own practice" ON public.practice_records FOR INSERT TO authenticated WITH CHECK (founder_id = auth.uid());
CREATE POLICY "Founders update own practice" ON public.practice_records FOR UPDATE TO authenticated USING (founder_id = auth.uid()) WITH CHECK (founder_id = auth.uid());
CREATE POLICY "Founders delete own practice" ON public.practice_records FOR DELETE TO authenticated USING (founder_id = auth.uid());
CREATE INDEX practice_records_founder_created_idx ON public.practice_records (founder_id, created_at DESC);
CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topics text[] NOT NULL DEFAULT ARRAY['all']::text[],
  text text NOT NULL CHECK (length(btrim(text)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lessons_topics_valid CHECK (cardinality(topics) > 0 AND array_position(topics, NULL) IS NULL AND NOT (topics && ARRAY['']) AND (NOT ('all' = ANY(topics)) OR topics = ARRAY['all']))
);
GRANT SELECT, INSERT, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read lessons" ON public.lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins add lessons" ON public.lessons FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete lessons" ON public.lessons FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX lessons_created_idx ON public.lessons (created_at DESC);