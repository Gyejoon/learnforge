# LearnForge

Local-first AI learning system with FSRS-6 spaced repetition.

학습 자료(PDF/MD/YouTube/URL/코드)를 수집하고, 인지과학 기반 6가지 능동 학습 모드로 이해를 깊게 하며, FSRS v4.5+ 알고리즘으로 장기 기억을 관리하는 MCP 서버.

## Quick Start

> **Prerequisites:** Node.js 20+

```bash
git clone https://github.com/Gyejoon/learnforge.git
cd learnforge
npm install        # 빌드 자동 실행 (prepare 스크립트)
npx learnforge setup   # DB 초기화 + Claude Desktop 설정 자동 주입
```

`learnforge setup`이 자동으로 처리하는 것:
- `~/.learnforge/learnforge.db` 생성 및 스키마 초기화
- `claude_desktop_config.json`에 learnforge MCP 서버 등록 (기존 설정 보존)

설정 완료 후 **Claude Desktop을 재시작**하면 바로 사용 가능합니다.

### Setup 옵션

```bash
npx learnforge setup                    # 기본: DB + Claude Desktop 설정
npx learnforge setup --skip-claude      # DB만 초기화 (Claude 설정 건너뜀)
npx learnforge setup --db /custom/path/learnforge.db  # 커스텀 DB 경로
```

### 수동 설정 (Claude Desktop config 직접 편집)

`learnforge setup` 대신 직접 설정하려면, `claude_desktop_config.json`에 추가:

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

## Claude Code 플러그인으로 설치

Claude Code에서 플러그인으로 설치하면 별도 설정 없이 바로 사용할 수 있습니다.

```bash
# 1. 마켓플레이스 등록
/plugin marketplace add Gyejoon/learnforge

# 2. 플러그인 설치
/plugin install learnforge@learnforge-marketplace
```

> **주의:** 플러그인은 내부적으로 `npx learnforge` CLI를 사용합니다. 아래 두 가지 중 하나로 CLI를 준비해야 합니다:

**방법 A — 글로벌 설치 (권장)**
```bash
git clone https://github.com/Gyejoon/learnforge.git
cd learnforge
npm install
npm link              # 글로벌 PATH에 learnforge 등록
learnforge setup      # DB 초기화
```

**방법 B — npx 자동 실행**
```bash
# learnforge 저장소를 클론하고 빌드만 해두면 npx가 자동으로 찾습니다
git clone https://github.com/Gyejoon/learnforge.git
cd learnforge
npm install           # 빌드 자동 실행
npx learnforge setup  # DB 초기화
```

설치 후 Claude Code에서 "학습하자", "퀴즈 내줘", "복습하자" 등을 말하면 자동으로 동작합니다.

---

## 사용법

Claude Desktop에서 자연어로 사용:

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

## 기술 스택

- TypeScript (ES2022) + Node.js 20+
- SQLite (better-sqlite3) — 로컬 퍼스트
- FSRS v4.5+ — 개인화된 간격 반복
- MCP SDK — Claude Desktop/Code 네이티브 연동

## CLI

MCP 없이 터미널에서 직접 사용할 수도 있습니다:

```bash
npx learnforge ingest "학습할 텍스트 내용"         # 텍스트 수집
npx learnforge ingest ./document.pdf               # PDF 수집
npx learnforge learn socratic --topic "FSRS"       # 소크라테스 학습
npx learnforge review                              # 오늘 복습할 카드 조회
npx learnforge answer <cardId> 3                   # 카드 응답 (1~4)
npx learnforge progress                            # 학습 진행도
npx learnforge export --format tsv                 # 카드 내보내기
npx learnforge status                              # 시스템 상태
```

## 개발

```bash
npm test              # 테스트 실행
npm run test:watch    # 감시 모드
npm run build         # TypeScript 빌드
```

## 라이선스

MIT
