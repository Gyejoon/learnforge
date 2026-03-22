# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # TypeScript 빌드 (tsc → dist/)
npm test               # vitest run (단일 실행)
npm run test:watch     # vitest (감시 모드)
npx vitest run src/fsrs/engine.test.ts   # 단일 테스트 파일 실행
npm run dev            # MCP 서버 개발 모드 (tsx src/adapters/mcp.ts)
npm run dev:http       # HTTP 서버 개발 모드
npm run dev:cli        # CLI 개발 모드
```

## Architecture

Local-first AI 학습 시스템. FSRS v4.5+ 간격반복, 인지과학 기반 6가지 학습 모드, SQLite 저장소.

### 3개의 진입점 → 1개의 핸들러 레이어

```
CLI (src/cli.ts)          ─┐
MCP Server (src/adapters/mcp.ts) ─┼→ LearnForgeHandlers (src/core/handlers.ts)
HTTP Server (src/adapters/http.ts) ─┘       │
                                    ├→ Storage (src/storage/)
                                    ├→ FSRS Engine (src/fsrs/engine.ts)
                                    ├→ Ingestion Pipeline (src/ingestion/)
                                    └→ Learning Modes (src/learning/modes.ts)
```

모든 비즈니스 로직은 `LearnForgeHandlers` 클래스에 집중. 어댑터(CLI/MCP/HTTP)는 입출력 변환만 담당.

### 핵심 모듈

- **core/handlers.ts** — 모든 기능의 오케스트레이터. `handleIngest`, `handleLearn`, `handleCreateCards`, `handleReview`, `handleAnswer`, `handleProgress`, `handleExport` 등
- **fsrs/engine.ts** — FSRS v4.5+ 알고리즘 순수 구현 (18개 가중치, retrievability/stability/difficulty 계산)
- **ingestion/** — 소스 타입 자동 감지(text/PDF/MD/code/YouTube/URL) → 콘텐츠 추출 → ~512토큰 청크 → SHA-256 중복 제거
- **learning/modes.ts** — 6개 학습 모드별 한국어 시스템 프롬프트 및 프롬프트 빌더
- **storage/** — SQLite(better-sqlite3) CRUD. WAL 모드, 외래키 활성화. 테이블별 파일 분리 (cards, chunks, reviews, sessions, sources, knowledge-map, settings)

### DB

- 경로: `~/.learnforge/learnforge.db` (환경변수 `LEARNFORGE_DB`로 커스텀 가능)
- 스키마: `src/storage/database.ts`에서 자동 생성
- 주요 테이블: sources, chunks, cards, reviews, sessions, knowledge_map, settings

### 타입 시스템

`src/types.ts`에 모든 공유 타입 정의. CardState(New/Learning/Review/Relearning), Rating(Again/Hard/Good/Easy) enum과 Source, Card, Chunk, Review, Session 인터페이스.

## Key Patterns

- **ESM** — `"type": "module"`, tsconfig target ES2022, module Node16
- **Zod** — MCP 어댑터의 도구 스키마 검증에 사용
- **Lazy DB init** — CLI에서 DB/핸들러를 명령 실행 시점에 초기화
- **JSON 출력** — CLI는 기본 JSON, `--pretty` 플래그로 포맷팅
