# LearnForge

Local-first AI learning system with FSRS-6 spaced repetition.

학습 자료(PDF/MD/YouTube/URL/코드)를 수집하고, 인지과학 기반 6가지 능동 학습 모드로 이해를 깊게 하며, FSRS v4.5+ 알고리즘으로 장기 기억을 관리하는 MCP/CLI 도구입니다.

## Quick Start

> Prerequisites: Node.js 20+

```bash
git clone https://github.com/Gyejoon/learnforge.git
cd learnforge
npm install
```

설치 후 원하는 클라이언트에 맞춰 `setup`을 한 번 실행합니다.

### Claude Desktop

```bash
npx learnforge setup
```

기본값은 `--target claude`이며, 다음을 자동으로 처리합니다.

- `~/.learnforge/learnforge.db` 생성 및 스키마 초기화
- `~/.learnforge/bin/learnforge` wrapper 생성
- `claude_desktop_config.json`에 LearnForge MCP 서버 등록

설정 후 Claude Desktop을 재시작하면 바로 사용할 수 있습니다.

### OpenClaw

```bash
npx learnforge setup --target openclaw
```

OpenClaw 대상 setup은 다음을 처리합니다.

- `~/.learnforge/learnforge.db` 생성 및 스키마 초기화
- `~/.learnforge/bin/learnforge` wrapper 생성
- `~/.openclaw/skills/learnforge/SKILL.md` 설치
- OpenClaw CLI가 있으면 스킬 로드 가능 상태까지 검증

OpenClaw CLI가 아직 설치되지 않았다면 setup은 전체 실패 대신 경고를 출력하고 DB/wrapper 준비까지만 마칩니다. OpenClaw를 설치한 뒤 같은 명령을 다시 실행하면 됩니다.

자세한 내용은 [docs/platforms/openclaw.md](docs/platforms/openclaw.md)를 참고하세요.

### 둘 다 설정

```bash
npx learnforge setup --target all
```

Claude Desktop과 OpenClaw를 한 번에 설정합니다.

## Setup 옵션

```bash
npx learnforge setup
npx learnforge setup --target claude
npx learnforge setup --target openclaw
npx learnforge setup --target all
npx learnforge setup --skip-claude
npx learnforge setup --db /custom/path/learnforge.db
```

- `--target claude|openclaw|all`: 플랫폼별 통합 범위 선택
- `--skip-claude`: 기존 호환 옵션. Claude Desktop config 주입 없이 DB와 wrapper만 준비
- `--db <path>`: 커스텀 DB 경로 사용

> `~/.learnforge/bin/learnforge` wrapper는 현재 checkout의 `dist/cli.js`를 가리킵니다. 저장소 위치를 옮겼다면 `setup`을 다시 실행하세요.

## Claude Code 플러그인 설치

Claude Code에서는 플러그인 설치 전에 LearnForge wrapper와 DB를 먼저 준비하는 것이 가장 안정적입니다.

```bash
# 1. 로컬 wrapper/DB 준비
npx learnforge setup --skip-claude

# 2. 마켓플레이스 등록
/plugin marketplace add Gyejoon/learnforge

# 3. 플러그인 설치
/plugin install learnforge@learnforge-marketplace
```

플러그인은 내부적으로 `~/.learnforge/bin/learnforge`를 호출합니다. 즉, 저장소를 클론한 뒤 `npm install`과 `learnforge setup`을 한 번만 해두면 Claude Code/Claude Desktop/OpenClaw가 같은 로컬 CLI를 재사용합니다.

## 수동 설정

### Claude Desktop config 직접 편집

자동 setup 대신 직접 설정하려면 `claude_desktop_config.json`에 추가합니다.

```json
{
  "mcpServers": {
    "learnforge": {
      "command": "node",
      "args": ["/absolute/path/to/learnforge/dist/mcp-server.js"]
    }
  }
}
```

커스텀 DB 경로가 필요한 경우:

```json
{
  "mcpServers": {
    "learnforge": {
      "command": "node",
      "args": ["/absolute/path/to/learnforge/dist/mcp-server.js"],
      "env": {
        "LEARNFORGE_DB": "/custom/path/learnforge.db"
      }
    }
  }
}
```

## 사용법

Claude/OpenClaw/Codex 등에서 자연어로 사용:

| 말하기 | 동작 |
|--------|------|
| "이 PDF 학습하자" | 자료 수집 (ingest) |
| "소크라테스 모드로 배우자" | 학습 세션 시작 |
| "퀴즈 내줘" | 적응형 퀴즈 |
| "카드 만들어줘" | 플래시카드 생성 |
| "복습하자" | FSRS 기반 복습 |
| "진행도 보여줘" | 통계 조회 |
| "Anki로 내보내기" | TSV/CSV/JSON 내보내기 |

## MCP 도구

| 도구 | 설명 |
|------|------|
| `learnforge_ingest` | PDF/MD/YouTube/URL/코드/텍스트 수집 |
| `learnforge_learn` | 6가지 학습 모드 세션 시작 |
| `learnforge_create_cards` | 플래시카드 생성 |
| `learnforge_review` | 오늘 복습할 카드 조회 |
| `learnforge_answer` | 복습 응답 (Again/Hard/Good/Easy) |
| `learnforge_progress` | 진행도 통계 (overview/deck/heatmap/gaps/forecast) |
| `learnforge_export` | 카드 내보내기 (TSV/CSV/JSON/Mochi MD) |
| `learnforge_sources` | 등록된 학습 자료 목록 |

## 학습 모드

| 모드 | 인지과학 원리 | 설명 |
|------|-------------|------|
| `socratic` | 생성 효과 | AI가 전략적 질문으로 통찰 유도 |
| `feynman` | 자기설명 효과 | 학습자가 설명하면 AI가 4축 피드백 |
| `quiz` | 인출 연습 | 적응형 난이도 퀴즈 |
| `teach` | Protege Effect | AI가 무지한 학생 역할, 학습자가 가르침 |
| `explore` | 정교화 | 자유 Q&A, 요약, 비교 |
| `gap` | 메타인지 | 지식 격차 진단 + 보고서 |

## CLI

MCP 없이 터미널에서 직접 사용할 수도 있습니다.

```bash
~/.learnforge/bin/learnforge ingest "학습할 텍스트 내용"
~/.learnforge/bin/learnforge ingest ./document.pdf
~/.learnforge/bin/learnforge learn socratic --topic "FSRS"
~/.learnforge/bin/learnforge review
~/.learnforge/bin/learnforge answer <cardId> 3
~/.learnforge/bin/learnforge progress
~/.learnforge/bin/learnforge export --format tsv
~/.learnforge/bin/learnforge status
```

## 기술 스택

- TypeScript (ES2022) + Node.js 20+
- SQLite (better-sqlite3)
- FSRS v4.5+
- MCP SDK

## 개발

```bash
npm test
npm run build
```

## 라이선스

MIT
