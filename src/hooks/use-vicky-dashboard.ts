import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { analyzeTidewell } from '@/lib/vicky/tidewell/analysis';
import { meetingBrief } from '@/lib/vicky/tidewell/brief';
import { getTidewellAnalysis, getMeetingBrief } from '@/lib/vicky.functions';
import { getCompanyDashboard } from '@/lib/companies.functions';
import { dashboardCoach } from '@/lib/vicky-dashboard';
import type { meetingSearchSchema } from '@/lib/vicky-inputs';
import type { z } from 'zod';
export function useVickySession() {
 const [session,setSession]=useState<Session|null>(null);
 useEffect(()=>{ void supabase.auth.getSession().then(({data})=>setSession(data.session)); const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return ()=>subscription.unsubscribe(); },[]);
 return session;
}
export function useVickyDashboard(choice:z.infer<typeof meetingSearchSchema>) {
 const session=useVickySession();
 const sample=analyzeTidewell();
 const fallback={analysis:sample,brief:meetingBrief(choice.persona,choice.stage,[],sample)};
 const query=useQuery({queryKey:['company-dashboard',session?.user.id,choice.company_id??'sample',choice.persona,choice.stage], enabled:!!session, queryFn:async()=>{
  if (!session) return fallback;
  if(choice.company_id) return getCompanyDashboard({data:{founder_id:session.user.id,...choice,company_id:choice.company_id}});
  const [analysis,brief]=await Promise.all([getTidewellAnalysis({data:{founder_id:session.user.id}}),getMeetingBrief({data:{founder_id:session.user.id,...choice}})]);
  return {analysis,brief};
 }});
 const data=choice.company_id?query.data:query.data??fallback;
 return {data,session,error:query.error,coach:data?dashboardCoach(data.analysis,data.brief,'profile' in data ? data.profile : undefined):undefined};
}
