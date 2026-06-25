# SYNAPSE — Multi-Agent Automated Code Reviewer & PR Bot

<div align="center">

```
███████╗██╗   ██╗███╗   ██╗ █████╗ ██████╗ ███████╗███████╗
██╔════╝╚██╗ ██╔╝████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝
███████╗ ╚████╔╝ ██╔██╗ ██║███████║██████╔╝███████╗█████╗  
╚════██║  ╚██╔╝  ██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝  
███████║   ██║   ██║ ╚████║██║  ██║██║     ███████║███████╗
╚══════╝   ╚═╝   ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝
```

**AI-powered multi-agent code review & PR automation platform**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2-blue?style=flat-square)](https://langchain-ai.github.io/langgraph/)
[![LiteLLM](https://img.shields.io/badge/LiteLLM-1.42-purple?style=flat-square)](https://litellm.ai)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38BDF8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)

</div>

---

## 🧠 What is SYNAPSE?

SYNAPSE is a production-grade, multi-agent AI code review platform that orchestrates 6 specialized AI agents through a LangGraph StateGraph to deliver comprehensive, automated code reviews with human-in-the-loop approval.

**Hermes** — the master orchestrator agent — coordinates all specialist agents, synthesises their findings into executive and technical narratives, and converses with you in natural language for approval before any changes are committed to GitHub.

---

## 🚀 The Paradigm Shift: Why SYNAPSE?

### 1. What It Is
SYNAPSE is a self-hosted, multi-agent AI platform designed to automate the pull request review cycle. Unlike traditional static analysis tools or single-prompt AI review integrations, SYNAPSE implements a coordinate-and-collaborate architecture. By splitting code review into distinct domains (syntax, security, testing, and refactoring), it achieves deep analysis that matches human reviewer standards.

### 2. Core Use Cases
- **Automated Pull Request Gatekeeping**: Automatically triggered via GitHub Webhooks whenever a PR is opened or updated, serving as the first line of review.
- **Pre-Commit Local Reviews**: Developers can paste code snippets or diffs into the SYNAPSE UI to run immediate, local reviews before staging changes.
- **Interactive Refactoring**: Using the conversational interface, developers can discuss suggested fixes with the orchestrator agent and request alternative implementations.
- **Security and Compliance Audits**: Dedicated scanning of files for OWASP vulnerabilities, hardcoded secrets, and unsafe dependencies prior to production deployment.
- **Automated Test Generation**: Identifying uncovered code branches and generating runnable tests to maintain high code coverage.

### 3. What is Trending Now? (Modern Tech Alignment)
SYNAPSE is built directly on the latest trends dominating the AI and software engineering landscape:
- **Agentic Workflows and Multi-Agent Orchestration**: Industry focus has shifted from single-LLM prompts to multi-agent systems where LLMs play specific, functional roles. SYNAPSE utilizes a fleet of five specialist agents led by a master coordinator.
- **LangGraph & StateGraph Architectures**: Utilizing LangGraph to define a cyclic, state-driven workflow. This allows the agents to read and write to a shared, evolving state, facilitating complex dependencies and routing.
- **Human-in-the-Loop (HITL)**: Purely autonomous AI agents can make mistakes. SYNAPSE addresses this by incorporating an explicit approval gate where a human reviewer must authorize the AI's suggestions before they are committed to GitHub.
- **Local and Private LLMs**: With the rise of tools like Ollama and LM Studio, running high-performance models locally is highly trending. SYNAPSE supports fully local deployment, ensuring source code never leaves the local machine.
- **Universal LLM Interoperability**: Through LiteLLM integration, the platform remains provider-agnostic, allowing users to hot-swap between local models (like Llama 3 or DeepSeek) and cloud models (like GPT-4o, Claude 3.5 Sonnet, or Gemini 1.5 Pro).

### 4. How It Helps
- **Reduces Code Review Bottlenecks**: Automates repetitive review tasks (linting, basic bug hunting, test coverage checks), allowing senior developers to focus on architectural decisions.
- **Enhances Code Quality and Security**: Catches OWASP top 10 vulnerabilities, memory leaks, and performance issues before they hit staging.
- **Speeds Up Onboarding and Testing**: Automatically generates ready-to-use tests, reducing the time developers spend writing boilerplates.
- **Provides Actionable Solutions**: Instead of just pointing out issues, it generates exact, Git-applicable diff patches to resolve them.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🧠 **Hermes Orchestrator** | Conversational AI agent that manages the entire pipeline, talks to you, asks for approval |
| 🔍 **Deep Code Analysis** | Python AST parsing, cyclomatic complexity, N+1 detection, type hint coverage |
| 🛡️ **OWASP Security Scan** | Full OWASP Top 10 (2021), CVE patterns, CVSS scoring, exploit likelihood |
| 🧪 **Test Generator** | Identifies gaps, generates ready-to-run pytest/Jest/JUnit tests |
| 🔧 **Fix Suggester** | Diff-backed, auto-applicable fix suggestions for every issue |
| 🐙 **GitHub PR Integration** | Inline comments, PR reviews, webhook automation |
| ⚡ **Universal LLM** | Ollama · LM Studio · OpenAI · Anthropic · Gemini · Groq · Azure · DeepSeek |
| 📡 **Real-time Streaming** | WebSocket-based live agent progress with token streaming |
| 💅 **Stunning UI** | Dark glassmorphism UI with Framer Motion animations |
| 🐳 **Docker Ready** | One `docker compose up` deployment |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SYNAPSE Platform                              │
│                                                                       │
│  React + Vite Frontend         FastAPI Backend                        │
│  ┌──────────────────┐         ┌─────────────────────────────────┐   │
│  │  Dashboard       │◄──WS───►│  WebSocket (real-time stream)   │   │
│  │  New Review      │◄──REST─►│  REST API (review, github, ws)  │   │
│  │  Review Detail   │         │                                  │   │
│  │  History         │         │  LangGraph StateGraph            │   │
│  │  GitHub          │         │  ┌────────────────────────────┐ │   │
│  │  Agents          │         │  │ START                      │ │   │
│  │  Settings        │         │  │   ↓                        │ │   │
│  │  └──────────────────┘         │  │ hermes_init                │ │   │
│                                │  │   ↓                        │ │   │
│  Zustand Store                 │  │ code_analyzer              │ │   │
│  React Query                   │  │   ↓                        │ │   │
│  Framer Motion                 │  │ security_scanner           │ │   │
│  TailwindCSS                   │  │   ↓                        │ │   │
│                                │  │ test_generator             │ │   │
│                                │  │   ↓                        │ │   │
│                                │  │ fix_suggester              │ │   │
│                                │  │   ↓                        │ │   │
│                                │  │ hermes_synthesize          │ │   │
│                                │  │   ↓                        │ │   │
│                                │  │ [approval gate]            │ │   │
│                                │  │   ↓                        │ │   │
│                                │  │ pr_manager → END           │ │   │
│                                │  └────────────────────────────┘ │   │
│                                │                                  │   │
│                                │  LiteLLM (Universal LLM Router)  │   │
│                                │  SQLAlchemy + SQLite/PostgreSQL   │   │
│                                │  PyGitHub                        │   │
│                                └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### The "Ponytail" Pattern (LangGraph)

SYNAPSE uses **LangGraph's StateGraph** as the multi-agent backbone. This is what we call the *Ponytail* pattern: defining a complex agent pipeline in minimal code.

```python
# The entire 6-agent pipeline is ~80 lines in workflow.py
builder = StateGraph(SynapseState)
builder.add_node("hermes_init",        _node_hermes_init)
builder.add_node("code_analyzer",      _node_code_analyzer)
builder.add_node("security_scanner",   _node_security_scanner)
builder.add_node("test_generator",     _node_test_generator)
builder.add_node("fix_suggester",      _node_fix_suggester)
builder.add_node("hermes_synthesize",  _node_hermes_synthesize)
builder.add_node("pr_manager",         _node_pr_manager)
# ... conditional edges
graph = builder.compile()
```

---

## 🤖 Agent Fleet

| Agent | Emoji | Role | What it does |
|---|---|---|---|
| **Hermes** | 🧠 | Master Orchestrator | Coordinates all agents, synthesises narrative, manages approval conversations |
| **CodeAnalyzer** | 🔍 | Static Analysis Engine | Python AST, complexity, bugs, performance, maintainability |
| **SecurityScanner** | 🛡️ | OWASP Security Auditor | OWASP Top 10, secrets detection, CVSS scoring, CVE lookup |
| **TestGenerator** | 🧪 | Coverage Gap Analyst | Identifies untested paths, generates pytest/Jest/JUnit tests |
| **FixSuggester** | 🔧 | Automated Refactoring | Diff-backed fix suggestions, auto-applicable flag |
| **PRManager** | 🐙 | GitHub PR Publisher | Posts reviews, inline comments, formal PR verdicts |

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- One LLM provider:
  - **Local**: [Ollama](https://ollama.ai) or [LM Studio](https://lmstudio.ai) (free, private)
  - **Cloud**: OpenAI, Anthropic, Gemini, Groq API key

### Option 1: Local Development (Recommended)

```bash
# ── Backend ──────────────────────────────────────────────────────────
cd backend
pip install poetry
poetry install
cp .env.example .env
# Edit .env — set your LLM provider + model

# Start backend
poetry run uvicorn main:app --reload --port 8000

# ── Frontend (new terminal) ───────────────────────────────────────────
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### Option 2: Docker Compose (Production)

```bash
# Copy and configure environment
cp backend/.env.example backend/.env
# Edit backend/.env

# Start everything
docker compose up --build -d

# Open http://localhost:3000
```

---

## ⚙️ Configuration

Edit `backend/.env` (copy from `backend/.env.example`):

### LLM Providers

```bash
# Ollama (local, free) — recommended for development
LLM_PROVIDER=ollama
LLM_MODEL=hermes3          # or llama3.2, codellama, deepseek-coder-v2
OLLAMA_BASE_URL=http://localhost:11434

# LM Studio (local, free)
LLM_PROVIDER=lmstudio
LMSTUDIO_BASE_URL=http://localhost:1234/v1

# OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Anthropic Claude
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Google Gemini
LLM_PROVIDER=gemini
GOOGLE_API_KEY=AIza...

# Groq (ultra-fast, free tier)
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3-3-70b-versatile

# DeepSeek Coder (code-specialized)
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-coder
```

### Hermes Orchestrator (can differ from specialist agents)

```bash
# Use a larger model for Hermes to improve orchestration quality
HERMES_PROVIDER=anthropic
HERMES_MODEL=claude-3-5-sonnet-20241022
```

### GitHub Integration

```bash
# Personal Access Token with repo + pull_requests scopes
# Create at: https://github.com/settings/tokens/new
GITHUB_TOKEN=ghp_...

# Auto-trigger reviews on PR open (webhook)
GITHUB_WEBHOOK_SECRET=your-secret
```

---

## 📖 Usage Guide

### 1. Paste Code Review

1. Navigate to **New Review**
2. Select **Paste Code** tab
3. Paste your code (any language)
4. Choose your LLM provider
5. Click **Start SYNAPSE Review**
6. Watch Hermes and the agent fleet work in real-time
7. Hermes will ask for your approval before posting to GitHub

### 2. GitHub PR Review

1. Navigate to **GitHub** → connect your token
2. Select a repository → choose an open PR
3. Click **Review PR**
4. SYNAPSE fetches all changed files from the PR
5. Agents run the full pipeline
6. Hermes synthesises findings and asks for approval
7. Approve → SYNAPSE posts inline comments + full review to GitHub

### 3. Webhook Automation

Add a GitHub webhook to auto-trigger reviews on every new PR:

```
URL: https://your-domain.com/api/github/webhook
Content-Type: application/json
Secret: your GITHUB_WEBHOOK_SECRET
Events: Pull requests
```

### 4. Chat with Hermes

On any review detail page, click the **Hermes** tab to have a natural conversation:
- *"Explain the SQL injection vulnerability on line 42"*
- *"Which fix should I prioritise?"*
- *"Is this safe to deploy to production?"*
- *"Generate a fix for the authentication issue"*

---

## 🗂️ Project Structure

```
├── backend/
│   ├── main.py                    # FastAPI application entry point
│   ├── pyproject.toml             # Python dependencies (Poetry)
│   ├── .env.example               # Environment configuration template
│   ├── Dockerfile
│   └── app/
│       ├── config.py              # Settings (Pydantic BaseSettings)
│       ├── schemas.py             # Pydantic models (request/response)
│       ├── database/
│       │   ├── connection.py      # Async SQLAlchemy engine
│       │   └── models.py          # ORM models
│       ├── agents/
│       │   ├── base.py            # BaseAgent (abstract)
│       │   ├── hermes.py          # 🧠 Master Orchestrator
│       │   ├── code_analyzer.py   # 🔍 Static Analysis Engine
│       │   ├── security_scanner.py# 🛡️ OWASP Security Auditor
│       │   ├── test_generator.py  # 🧪 Test Generator
│       │   ├── fix_suggester.py   # 🔧 Fix Suggester
│       │   └── pr_manager.py      # 🐙 GitHub PR Publisher
│       ├── graph/
│       │   ├── state.py           # SynapseState (shared LangGraph state)
│       │   └── workflow.py        # LangGraph StateGraph (the pipeline)
│       ├── services/
│       │   ├── llm_service.py     # Universal LLM (LiteLLM wrapper)
│       │   ├── github_service.py  # GitHub API (PyGitHub wrapper)
│       │   └── review_service.py  # Review lifecycle orchestration
│       └── api/routes/
│           ├── review.py          # Review CRUD + approval endpoints
│           ├── github.py          # GitHub integration endpoints
│           ├── settings_router.py # LLM + review settings
│           ├── ws.py              # WebSocket (streaming)
│           └── agents.py         # Agent info + status
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── src/
│       ├── App.tsx                # Router + layout
│       ├── index.css              # Global styles + Tailwind utilities
│       ├── types/index.ts         # TypeScript types
│       ├── lib/
│       │   ├── api.ts             # Axios API client
│       │   ├── websocket.ts       # WebSocket client (auto-reconnect)
│       │   └── utils.ts           # Helpers (cn, formatters, colors)
│       ├── stores/
│       │   └── reviewStore.ts     # Zustand global state
│       ├── pages/
│       │   ├── Dashboard.tsx      # Overview + stats
│       │   ├── NewReview.tsx      # Code paste + GitHub PR form
│       │   ├── ReviewDetail.tsx   # Live review with tabs
│       │   ├── History.tsx        # Paginated review history
│       │   ├── GitHub.tsx         # GitHub integration page
│       │   ├── Agents.tsx         # Agent fleet overview
│       │   └── Settings.tsx       # LLM + GitHub settings
│       └── components/
│           ├── layout/
│           │   └── MainLayout.tsx # Sidebar + topbar shell
│           └── review/
│               ├── AgentPipeline.tsx  # Live agent status dots
│               ├── HermesChat.tsx     # Chat with Hermes
│               ├── ScoreRing.tsx      # Animated SVG score ring
│               ├── IssueCard.tsx      # Expandable issue card
│               ├── SecurityCard.tsx   # Vulnerability card
│               ├── TestCard.tsx       # Test suggestion card
│               └── FixCard.tsx        # Diff viewer + fix card
│
├── docker-compose.yml
└── .gitignore
```

*(Note: The project structure above has been updated to reflect the root-level layout, eliminating the nested `synapse/` subdirectory.)*

---

## 🔌 API Reference

### Review Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/review/` | Start a new review (async, returns session_id) |
| `GET` | `/api/review/` | List all reviews |
| `GET` | `/api/review/{id}` | Get review by session_id |
| `DELETE` | `/api/review/{id}` | Delete a review |
| `POST` | `/api/review/{id}/approve` | Submit approval decision |
| `POST` | `/api/review/{id}/hermes` | Chat with Hermes |

### GitHub Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/github/status` | Connection status |
| `POST` | `/api/github/connect` | Connect GitHub token |
| `GET` | `/api/github/repos` | List repositories |
| `GET` | `/api/github/repos/{owner}/{repo}/prs` | List PRs |
| `POST` | `/api/github/review-pr` | Trigger PR review |
| `POST` | `/api/github/webhook` | GitHub webhook endpoint |

### WebSocket

| Path | Description |
|---|---|
| `WS /ws/{session_id}` | Real-time review event stream |
| `WS /ws/hermes/{session_id}` | Bidirectional Hermes conversation |

### Settings

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/settings/` | Get all settings + provider list |
| `PUT` | `/api/settings/` | Update settings |
| `POST` | `/api/settings/test-llm` | Test LLM connection |
| `GET` | `/api/settings/ollama/models` | List Ollama models |
| `GET` | `/api/settings/lmstudio/models` | List LM Studio models |

---

## 🏆 Resume/Portfolio Highlights

SYNAPSE demonstrates mastery of:

**AI & Multi-Agent Systems**
- LangGraph StateGraph for multi-agent orchestration (directed acyclic graph with conditional edges)
- Human-in-the-loop (HITL) approval workflows
- LiteLLM for provider-agnostic LLM routing (100+ providers, one API)
- Prompt engineering for specialized agents (security, code analysis, test generation)

**Backend Engineering**
- Async FastAPI with WebSocket streaming
- SQLAlchemy 2.0 async ORM with Alembic migrations
- Domain-driven design (services, repositories, schemas)
- Retry logic with exponential backoff (tenacity)
- Structlog structured logging

**Frontend Engineering**
- React 18 + TypeScript with strict mode
- Zustand for reactive global state
- React Query for server state + cache invalidation
- Framer Motion for production-grade animations
- WebSocket client with auto-reconnect + exponential backoff
- Compound component patterns (IssueCard, AgentPipeline)

**DevOps & Production**
- Docker + Docker Compose multi-service deployment
- Nginx reverse proxy with WebSocket support
- Environment-based configuration (12-factor app)
- Health check endpoints

---

## 🛠️ Development

### Running Tests

```bash
cd backend
poetry run pytest tests/ -v
```

### Code Quality

```bash
# Format
poetry run black .
poetry run ruff check . --fix

# Type check
poetry run mypy app/
```

### Adding a New Agent

1. Create `app/agents/my_agent.py` extending `BaseAgent`
2. Add a node in `app/graph/workflow.py`
3. Add fields to `SynapseState` in `app/graph/state.py`
4. Add the agent to `app/api/routes/agents.py` registry
5. Export from `app/agents/__init__.py`

---

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

<div align="center">

Built with ❤️ by SYNAPSE · Powered by [LangGraph](https://langchain-ai.github.io/langgraph/) + [LiteLLM](https://litellm.ai) + [Hermes](https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-8B)

</div>
