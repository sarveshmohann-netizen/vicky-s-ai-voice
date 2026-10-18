import { availableCharts, prepPlan, scenarioBase } from './vicky/coach';
import type { TidewellAnalysis } from './vicky/tidewell/analysis';
import type { CompanyAnalysis, CompanyProfile } from './vicky/company/analysis';
import type { MeetingBrief } from './vicky/tidewell/brief';
import type { CompanyBrief } from './vicky/company/brief';
export function dashboardCoach(analysis: TidewellAnalysis | CompanyAnalysis, brief: MeetingBrief | CompanyBrief, profile?: CompanyProfile) {
 const charts = availableCharts(analysis.charts);
 return { charts, plan: prepPlan(brief.lens, charts), scenarioBase: scenarioBase(analysis.metrics, profile ? { ...(profile.raiseAmount === undefined ? {} : {raise:profile.raiseAmount}), ...(profile.planMonthlySpendAfterRaise === undefined ? {} : {plannedBurn:profile.planMonthlySpendAfterRaise}) } : {raise:4000000}) };
}
export const CLARIFICATION = "That didn't answer what I needed. Ask me one short question to understand what I'm after.";
export function cleanReplyText(text: string) { return text.replace(/\[\[[\s\S]*?(?:\]\]|$)/g,'').replace(/\[(?:P&L|You|Plan|Deck|Pack)[^\]]*\]/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/[*#_`]/g,'').trim(); }
