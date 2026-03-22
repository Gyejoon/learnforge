# LearnForge

Local-first AI learning system with FSRS-6 spaced repetition.

학습 자료(PDF/MD/YouTube/URL/코드)를 수집하고, 인지과학 기반 6가지 능동 학습 모드로 이해를 깊게 하며, FSRS v4.5+ 알고리즘으로 장기 기억을 관리하는 MCP 서버.

## 설치

```bash
git clone https://github.com/Gyejoon/learnforge.git
cd learnforge
npm install
npm run build
npm run setup-db
```

## Claude Desktop 연동

`claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "learnforge": {
      "command": "node",
      "args": ["/path/to/learnforge/dist/mcp-server.js"]
    }
  }
}
```

> `args`의 경로를 실제 클론한 위치의 절대 경로로 변경하세요.

`LEARNFORGE_DB` 환경 변수로 DB 경로를 지정할 수 있습니다 (기본값: `~/.learnforge/learnforge.db`):

```json
{
  "mcpServers": {
    "learnforge": {
      "command": "node",
      "args": ["/path/to/learnforge/dist/mcp-server.js"],
      "env": {
        "LEARNFORGE_DB": "/custom/path/learnforge.db"
      }
    }
  }
}
```

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

## 개발

```bash
npm test              # 테스트 실행
npm run test:watch    # 감시 모드
npm run build         # TypeScript 빌드
npm run setup-db      # DB 초기화
```

## 라이선스

MIT
