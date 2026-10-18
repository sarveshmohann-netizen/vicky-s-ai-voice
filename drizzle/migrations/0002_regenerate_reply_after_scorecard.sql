CREATE OR REPLACE FUNCTION public.vicky_prepare_turn(p_conversation uuid, p_action text, p_message uuid DEFAULT NULL, p_content text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE c public.conversations; m public.messages; last_message public.messages; rows_json jsonb;
BEGIN
 SELECT * INTO c FROM public.conversations WHERE id = p_conversation AND founder_id = auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found'; END IF;
 IF p_action IN ('send','edit') AND (p_content IS NULL OR length(trim(p_content)) NOT BETWEEN 1 AND 20000) THEN RAISE EXCEPTION 'Invalid message'; END IF;
 IF p_action = 'send' THEN
  IF NOT EXISTS(SELECT 1 FROM public.messages WHERE conversation_id = c.id) THEN UPDATE public.conversations SET title = left(array_to_string((regexp_split_to_array(trim(p_content), '\s+'))[1:6], ' '),200) WHERE id = c.id; END IF;
  INSERT INTO public.messages(conversation_id,role,content) VALUES(c.id,'user',trim(p_content));
 ELSIF p_action = 'edit' THEN
  SELECT * INTO m FROM public.messages WHERE id=p_message AND conversation_id=c.id AND role='user';
  IF NOT FOUND THEN RAISE EXCEPTION 'User message not found'; END IF;
  DELETE FROM public.messages WHERE conversation_id=c.id AND (created_at,id) > (m.created_at,m.id);
  UPDATE public.messages SET content=trim(p_content) WHERE id=m.id;
 ELSIF p_action = 'regenerate' THEN
  SELECT * INTO last_message FROM public.messages WHERE conversation_id=c.id AND content NOT LIKE 'vicky-grade:%' ORDER BY created_at DESC,id DESC LIMIT 1;
  IF last_message.role='assistant' THEN
   IF p_message IS DISTINCT FROM last_message.id THEN RAISE EXCEPTION 'Only the latest reply can be regenerated'; END IF;
   DELETE FROM public.messages WHERE conversation_id=c.id AND (created_at,id) >= (last_message.created_at,last_message.id);
  ELSIF last_message.role IS DISTINCT FROM 'user' THEN RAISE EXCEPTION 'No answer to regenerate'; END IF;
 ELSE RAISE EXCEPTION 'Invalid action'; END IF;
 UPDATE public.conversations SET updated_at=clock_timestamp() WHERE id=c.id;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at,x.id),'[]'::jsonb) INTO rows_json FROM public.messages x WHERE conversation_id=c.id;
 RETURN jsonb_build_object('conversation', (SELECT to_jsonb(x) FROM public.conversations x WHERE id=c.id), 'messages',rows_json);
END $$;
REVOKE ALL ON FUNCTION public.vicky_prepare_turn(uuid,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vicky_prepare_turn(uuid,text,uuid,text) TO authenticated;