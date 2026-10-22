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
- External AI agents connect via the app-hosted MCP server in `src/lib/mcp/` (OAuth through Cloud Auth, caller-scoped client so RLS applies); tools are read-only and resolve the caller's family themselves — never accept user ids from tool input.
- Caja Menor month selection uses date-only month keys in `src/lib/expense-history.ts`; historical views hide write controls and show actual category spending instead of applying today's mutable budgets retroactively.

- Community feedback rows are inserted only by the `enviarOpinion` server function after AI moderation (no client INSERT grant) so moderation cannot be bypassed.
