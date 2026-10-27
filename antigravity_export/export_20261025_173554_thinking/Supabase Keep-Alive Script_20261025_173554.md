# Supabase Keep-Alive Script

- **Cascade ID**: `a8bfb3d6-f0e8-4026-b485-c5df706c4bb7`
- **Steps**: 33
- **Status**: CASCADE_RUN_STATUS_IDLE
- **Created**: 2026-01-11T03:43:59.237543300Z
- **Last Modified**: 2026-01-11T03:45:08.722734Z
- **Workspace**: file:///c:/git/xtech-all/xtech
- **Exported**: 2026-10-25 22:35:55

---

## 🧑 User  `2026-01-11T03:43:59`
is it possible to build a script that keeps my supabase free plan database alive and not paused automatically?
Yes — it’s absolutely possible, and people do it all the time — but with an important caveat: Supabase’s free tier intentionally pauses after 7 days of inactivity, and any workaround is essentially just generating artificial activity. Supabase allows this, but it’s not “officially supported.”

Your question is essentially about whether you can automate periodic pings to keep the project active. The answer is yes, and the search results confirm multiple working approaches:

How people keep Supabase free-tier projects alive
Several community solutions exist that periodically “touch” the database so Supabase doesn’t mark it inactive:

Approaches others use
GitHub Actions keep-alive workflow — A scheduled GitHub Action that runs daily and sends a simple request to your Supabase project. This is described in detail in a tutorial.

KeepSupabaseAlive service — A tool that automatically generates a GitHub Actions workflow for you, no credentials stored, runs daily.

Self-hosted keep-alive scripts — Some developers run a tiny cron job or serverless function that performs a trivial query (e.g., select now()) to keep the DB active. GitHub repos like supabase-pause-prevention show examples.

Python or Next.js automation scripts — Tutorials show how to automate inserts/deletes or simple selects to maintain activity.

All of these rely on the same mechanism: any database activity within 7 days prevents pausing.

What Supabase officially says
Supabase’s free tier pauses after a week of inactivity. Paid tiers don’t pause. This is confirmed in multiple guides and posts.

Should you do it?
If you’re building a real product, I’d challenge you to think about whether a free-tier database is the right foundation. But for hobby projects, prototypes, or learning, a keep-alive script is harmless and widely used.

Want me to generate a minimal keep-alive script for you?
I can produce:

a GitHub Actions workflow

a Node.js  cron script

a Python script

a serverless function

or a Next.js  API route

Each one can ping your Supabase project daily with a trivial query.

Which direction do you want — GitHub Actions, Node.js cron, Python script, or Next.js API route?



can you make a keep alive script?

### 🔧 Tool: `list_dir`  `2026-01-11T03:44:08`
`[List Directory]`

### 🔧 Tool: `code_edit`  `2026-01-11T03:44:10`
[Code Edit] file:///C:/Users/aarav/.gemini/antigravity/brain/a8bfb3d6-f0e8-4026-b485-c5df706c4bb7/task.md

### 🔧 Tool: `view_file`  `2026-01-11T03:44:20`
`file:///c:/git/xtech-all/xtech/package.json` (31 lines, 670 bytes)

### 🔧 Tool: `list_dir`  `2026-01-11T03:44:20`
`[List Directory]`

### 🔧 Tool: `code_edit`  `2026-01-11T03:44:22`
[Code Edit] file:///C:/Users/aarav/.gemini/antigravity/brain/a8bfb3d6-f0e8-4026-b485-c5df706c4bb7/task.md

### 🔧 Tool: `list_dir`  `2026-01-11T03:44:33`
`[List Directory]`

### 🔧 Tool: `code_edit`  `2026-01-11T03:44:38`
[Code Edit] file:///C:/Users/aarav/.gemini/antigravity/brain/a8bfb3d6-f0e8-4026-b485-c5df706c4bb7/implementation_plan.md

## 🧑 User  `2026-01-11T03:44:38`
This is a system-generated message that is sent due to the user's review policy. Proceed with the decision that you think is the most optimal here.

### 🔧 Tool: `code_edit`  `2026-01-11T03:44:50`
[Code Edit] file:///c:/git/xtech-all/xtech/scripts/keep-alive.js

### 🔧 Tool: `code_edit`  `2026-01-11T03:44:53`
[Code Edit] file:///c:/git/xtech-all/xtech/.github/workflows/keep-alive.yml

### 🔧 Tool: `code_edit`  `2026-01-11T03:44:54`
[Code Edit] file:///C:/Users/aarav/.gemini/antigravity/brain/a8bfb3d6-f0e8-4026-b485-c5df706c4bb7/task.md

### 🔧 Tool: `code_edit`  `2026-01-11T03:45:06`
[Code Edit] file:///C:/Users/aarav/.gemini/antigravity/brain/a8bfb3d6-f0e8-4026-b485-c5df706c4bb7/walkthrough.md

### 🔧 Tool: `code_edit`  `2026-01-11T03:45:07`
[Code Edit] file:///C:/Users/aarav/.gemini/antigravity/brain/a8bfb3d6-f0e8-4026-b485-c5df706c4bb7/task.md
