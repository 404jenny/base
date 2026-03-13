# base

> **User = CEO. base = Manager. Agents = Employees.**

base is a native desktop AI agent OS — a unified interface for spinning up AI agents, assigning them tasks, and watching them execute in real time through a live communication feed.

You give the command. base routes it. Your agents handle the work and report back.

---

## What it does

- **Create agents** — spin up named agents powered by Claude or ChatGPT (Gemini coming soon)
- **Assign tasks** — give any agent a task and watch it execute live
- **Multi-agent collaboration** — agents like CuriousClaude (Claude) and YapGPT (ChatGPT) can work together on a task, each doing their part and relaying results back to base
- **Confirmation gating** — the base AI orchestrator pauses before any consequential action until you approve
- **Pipeline visibility** — every task moves through a live status bar: `Queued → Routing → Executing → Complete`
- **Web search** — all native agents have web search built in
- **Real-time feed** — a shared communication feed shows everything agents are doing and saying

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | React 19 + TypeScript + Tailwind CSS v4 |
| Animation | Motion (Framer) v12 |
| Icons | Lucide React |
| Auth + Settings | Supabase |
| Local DB | SQLite (`~/.base/base.db`) |
| Sidecar | Node.js WebSocket server (port 41801) |
| AI providers | Claude API, ChatGPT API |

---

## Architecture

base runs as two parallel processes:

1. **Tauri frontend** — React UI that communicates with the sidecar over WebSocket
2. **Node.js sidecar** — handles all agent orchestration, task execution, and message broadcasting independently

### Data flow

```
User assigns task
    → base AI orchestrator routes it
    → needsConfirmation: true? → wait for user approval
    → agent executes via runner.ts → adapters/native.ts
    → results broadcast over WebSocket
    → UI feed updates in real time
```

### File structure

```
src/
  components/       # UI components
  hooks/            # useSidecar.ts and other hooks
  lib/              # Shared utilities

src-sidecar/
  agents/           # Agent definitions and CRUD
  base-ai/          # base orchestrator logic
  tasks/            # Task execution
  db.ts             # SQLite interface
  index.ts          # WebSocket server entry
```

---

## Getting started

### Prerequisites

- Node.js
- Rust toolchain
- Tauri CLI

### Install & run

```bash
# Terminal 1 — frontend + Tauri shell
npm install --legacy-peer-deps
npm run tauri dev

# Terminal 2 — Node.js sidecar
cd src-sidecar
npm install --legacy-peer-deps
npm run dev
```

Set your API keys via the settings panel in the app or directly in Supabase under `user_settings`.

### Key conventions

- Window controls use Tauri `invoke()` — never `getCurrentWindow()`
- `--legacy-peer-deps` required for all npm installs (set in `.npmrc`)
- Messages use camelCase: `senderId`, `senderName`, `timestamp`
- Duplicate message dedup handled via `seenMessages` ref in `useSidecar`

---

## Current status

### ✅ Working
- Claude API + ChatGPT API agent execution
- Multi-agent collaboration (CuriousClaude + YapGPT)
- base AI orchestrator with confirmation gating
- Real-time WebSocket communication feed
- Pipeline status bar: Queued → Routing → Executing → Complete
- Auth, onboarding, settings panel with smart API key detector
- Agent creation, task assignment, web search

### 🔧 In progress
- Gemini API integration
- Slack MCP server connection via Docker SSE

### 🗺 Roadmap
- Expand to as many APIs and apps as possible as callable agent tools
- Open integration layer — connect any service to any agent
- Universal AI agent OS, not a single-purpose workflow tool

---

## Built by 

Jenny Truong — [jnnyswrld.framer.website](https://jnnyswrld.framer.website) · [LinkedIn](https://www.linkedin.com/in/vuong-anh-truong/) · [Portfolio](https://www.notion.so/2fccdb3df59d8031a149ee21343a0110)
