# Skill Registry — agent-analytics

> Index of available skills. This registry is an INDEX, not a summary: subagents must read the full `SKILL.md` at the listed path before using a skill.
> Generated: 2026-08-25 by sdd-init v3.0. Scope legend: `user` = installed user-level (shared across projects); `project` = this repo only.

## Project Convention Files

- None found. Project directory was empty at init time (no `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `GEMINI.md`, `copilot-instructions.md`).

## Skills Index

| Name | Trigger | Scope | Path |
|---|---|---|---|
| branch-pr | Creating, opening, or preparing PRs for review | user | `/Users/pablocastarataro/.config/opencode/skills/branch-pr/SKILL.md` |
| chained-pr | PRs over 400 lines, stacked PRs, review slices | user | `/Users/pablocastarataro/.config/opencode/skills/chained-pr/SKILL.md` |
| cognitive-doc-design | Writing guides, READMEs, RFCs, onboarding, architecture, or review-facing docs | user | `/Users/pablocastarataro/.config/opencode/skills/cognitive-doc-design/SKILL.md` |
| comment-writer | PR feedback, issue replies, reviews, Slack messages, GitHub comments | user | `/Users/pablocastarataro/.config/opencode/skills/comment-writer/SKILL.md` |
| go-testing | Go tests, coverage, Bubbletea teatest, golden files | user | `/Users/pablocastarataro/.config/opencode/skills/go-testing/SKILL.md` |
| issue-creation | Creating GitHub issues, bug reports, feature requests | user | `/Users/pablocastarataro/.config/opencode/skills/issue-creation/SKILL.md` |
| judgment-day | Judgment day, dual review, adversarial review | user | `/Users/pablocastarataro/.config/opencode/skills/judgment-day/SKILL.md` |
| paperclip | Paperclip control plane API: assignments, task status, delegation, routines | user | `/Users/pablocastarataro/.claude/skills/paperclip/SKILL.md` |
| paperclip-board | Manage a Paperclip company as board member via chat | user | `/Users/pablocastarataro/.claude/skills/paperclip-board/SKILL.md` |
| paperclip-converting-plans-to-tasks | Converting plans into executable Paperclip tasks/issues | user | `/Users/pablocastarataro/.claude/skills/paperclip-converting-plans-to-tasks/SKILL.md` |
| paperclip-create-agent | Create new Paperclip agents with governance-aware hiring | user | `/Users/pablocastarataro/.claude/skills/paperclip-create-agent/SKILL.md` |
| paperclip-dev | Develop and operate a local Paperclip instance | user | `/Users/pablocastarataro/.claude/skills/paperclip-dev/SKILL.md` |
| para-memory-files | File-based PARA memory: facts, daily notes, plans, recall | user | `/Users/pablocastarataro/.claude/skills/para-memory-files/SKILL.md` |
| pr-review | PR review, code review (entry point) | user | `/Users/pablocastarataro/.config/opencode/skills/pr-review/SKILL.md` |
| pr-review-bff | BFF/API patterns in reviewed diffs | user | `/Users/pablocastarataro/.config/opencode/skills/pr-review-bff/SKILL.md` |
| pr-review-feedback | Collect/classify PR review feedback | user | `/Users/pablocastarataro/.config/opencode/skills/pr-review-feedback/SKILL.md` |
| pr-review-frontend | Frontend patterns (React/Vue/Angular/Next/RN/i18n) in diffs | user | `/Users/pablocastarataro/.config/opencode/skills/pr-review-frontend/SKILL.md` |
| pr-review-global | Global review rules (always loaded during PR review) | user | `/Users/pablocastarataro/.config/opencode/skills/pr-review-global/SKILL.md` |
| pr-review-js | JavaScript/TypeScript conventions in diffs | user | `/Users/pablocastarataro/.config/opencode/skills/pr-review-js/SKILL.md` |
| pr-review-patterns | Cross-project anti-pattern learning from findings | user | `/Users/pablocastarataro/.config/opencode/skills/pr-review-patterns/SKILL.md` |
| skill-creator | New skills, agent instructions, LLM-first skill authoring | user | `/Users/pablocastarataro/.config/opencode/skills/skill-creator/SKILL.md` |
| skill-improver | Improve, audit, refactor existing skills | user | `/Users/pablocastarataro/.claude/skills/skill-improver/SKILL.md` |
| work-unit-commits | Plan commits as reviewable work units; commit splitting | user | `/Users/pablocastarataro/.config/opencode/skills/work-unit-commits/SKILL.md` |

## Notes

- Skipped per convention: all `sdd-*` skills, `_shared`, and `skill-registry`.
- Duplicates: every non-Paperclip/PARA entry above also exists (identical) in `~/.claude/skills`, `~/.cursor/skills`, and `~/.copilot/skills`; canonical path listed. `~/.codex/skills` exists but contains no skills. Missing locations: `~/.pi/agent/skills`, `~/.config/agents/skills`, `~/.agents/skills`, `~/.kimi/skills`, `~/.config/kilo/skills`, `~/.gemini/skills`, `~/.gemini/antigravity/skills`, `~/.codeium/windsurf/skills`, `~/.qwen/skills`, `~/.kiro/skills`, `~/.openclaw/skills`.
- Project has no project-level skill directories yet.
