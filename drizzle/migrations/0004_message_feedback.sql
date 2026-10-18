ALTER TABLE public.messages ADD COLUMN feedback text CHECK (feedback IN ('up', 'down'));
ALTER TABLE public.messages ADD COLUMN hidden boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.vicky_set_feedback(p_message uuid, p_feedback text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF p_feedback IS NULL OR p_feedback NOT IN ('up','down') THEN RAISE EXCEPTION 'Invalid feedback'; END IF;
 UPDATE public.messages m SET feedback=p_feedback WHERE m.id=p_message AND m.role='assistant' AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id=m.conversation_id AND c.founder_id=auth.uid());
 IF NOT FOUND THEN RAISE EXCEPTION 'Message unavailable'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.vicky_set_feedback(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vicky_set_feedback(uuid,text) TO authenticated;
GRANT ALL ON FUNCTION public.vicky_set_feedback(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.vicky_hide_clarification(p_conversation uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 UPDATE public.messages m SET hidden=true WHERE m.id=(SELECT id FROM public.messages WHERE conversation_id=p_conversation AND role='user' ORDER BY created_at DESC,id DESC LIMIT 1) AND m.content='That didn''t answer what I needed. Ask me one short question to understand what I''m after.' AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id=m.conversation_id AND c.founder_id=auth.uid());
 IF NOT FOUND THEN RAISE EXCEPTION 'Clarification unavailable'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.vicky_hide_clarification(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vicky_hide_clarification(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.vicky_hide_clarification(uuid) TO service_role;