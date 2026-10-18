CREATE TABLE public.companies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), founder_id uuid NOT NULL DEFAULT auth.uid(), name text NOT NULL, currency text NOT NULL DEFAULT 'USD', source_csv text NOT NULL, parsed jsonb NOT NULL, profile jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders manage own companies" ON public.companies FOR ALL TO authenticated USING (founder_id = auth.uid()) WITH CHECK (founder_id = auth.uid());
CREATE INDEX companies_founder ON public.companies(founder_id, updated_at DESC);
ALTER TABLE public.conversations ADD COLUMN company_id uuid DEFAULT NULL REFERENCES public.companies(id);
ALTER TABLE public.practice_records ADD COLUMN company_id uuid DEFAULT NULL REFERENCES public.companies(id);
CREATE OR REPLACE FUNCTION public.validate_company_owner() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = NEW.company_id AND c.founder_id = NEW.founder_id) THEN RAISE EXCEPTION 'Company is unavailable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER conversations_company_owner BEFORE INSERT OR UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.validate_company_owner();
CREATE TRIGGER practice_company_owner BEFORE INSERT OR UPDATE ON public.practice_records FOR EACH ROW EXECUTE FUNCTION public.validate_company_owner();