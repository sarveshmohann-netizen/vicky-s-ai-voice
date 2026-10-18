<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application rules
- Share the Vicky header and global presentation tokens across content screens so visual updates preserve consistent navigation without changing engine logic.
- Store application data through the generated browser client or authenticated server-function context client with database-enforced access policies; role assignments live in a protected role table to prevent self-escalation.
- Keep the lessons page public with inline sign-in and a client-only administrator workspace; this preserves OAuth callbacks while enforcing write permissions in the database.
- Keep UI topic normalization outside the tested Vicky engine; organisers' calculations and data must not be duplicated.
- Keep Vicky RPC exports in a client-safe functions module and AI/storage helpers server-only, so secrets and prompts never ship to browsers.
- Stream Vicky chat through a bearer-verified HTTP route reached from its RPC entry point; RPC returns only serializable data, not a Response or stream.
- Persist optional assumption flag IDs and code-produced fact checks inside practice grade JSON alongside rubric scores, so readiness can reconstruct practice without extra tables or invented evidence.
- Keep investor and stage preferences in validated route search parameters shared by meeting prep and practice; this makes demo links reproducible.
- Render meeting charts and briefs from the read-only engine output, with shared source-chip parsing outside the engine; this prevents duplicated financial calculations and keeps citations consistent.
- Combine coaching chat, question grading and pitch simulation in the Practice route; this keeps the demo in one navigation flow.
- Keep saved chat identity in a dedicated Practice URL and enforce conversation ownership through RLS and authenticated server calls; this restores the correct history on reload.
- Prepare edits and regeneration atomically in database functions, and save completed replies in the existing SSE server handler with a version guard; this prevents stale replies overwriting newer chat state.
- Compose saved-chat UI from AI Elements while preserving Vicky's existing RPC and SSE transport; this retains the requested endpoint and citation behavior without changing engine logic.
