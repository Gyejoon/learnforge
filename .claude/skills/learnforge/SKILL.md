---
name: learnforge
description: "AI 학습 시스템 — 자료 수집(ingest), 인지과학 기반 학습 세션, FSRS 간격반복 복습, 플래시카드 생성/관리를 CLI로 수행한다. 사용자가 '학습하자', '복습하자', '카드 만들어', '진행도 보여줘', 'PDF 학습', '퀴즈', '소크라테스', '파인만', 'Anki 내보내기' 등 학습 관련 요청을 하면 반드시 이 스킬을 사용한다. 학습 자료, 플래시카드, 간격반복, spaced repetition, FSRS 키워드가 등장해도 트리거한다."
---

# LearnForge

학습 자료를 수집하고, 6가지 인지과학 기반 모드로 학습하며, FSRS 알고리즘으로 장기 기억을 관리하는 시스템.
MCP 서버 설정 없이 CLI만으로 모든 기능을 사용할 수 있다.

## 설치 확인

이 스킬을 처음 사용할 때, learnforge CLI가 동작하는지 확인한다:

```bash
npx learnforge status --pretty
```

실패하면 사용자에게 설치를 안내한다:

```bash
git clone https://github.com/Gyejoon/learnforge.git
cd learnforge
npm install          # 빌드 자동 실행
npx learnforge setup --skip-claude
```

## CLI 명령어

모든 명령은 `npx learnforge`로 실행하고, 결과를 파싱하려면 `--pretty` 없이 실행한다 (JSON 출력).
사용자에게 보여줄 때는 `--pretty`를 붙인다.

### 자료 수집

```bash
npx learnforge ingest "<텍스트 또는 파일경로 또는 URL>" --pretty
npx learnforge ingest "<source>" --title "제목" --deck "덱이름" --pretty
```

지원 소스: 텍스트, 파일 경로(PDF/MD), URL, YouTube 링크

### 학습 세션

```bash
npx learnforge learn <mode> --topic "주제" --pretty
npx learnforge learn <mode> --deck "덱이름" --pretty
```

| 모드 | 원리 | 설명 |
|------|------|------|
| `socratic` | 생성 효과 | AI가 전략적 질문으로 통찰 유도. 답을 직접 주지 않는다. |
| `feynman` | 자기설명 효과 | 학습자가 설명하면 4축 피드백 (정확/부정확/누락/혼란) |
| `quiz` | 인출 연습 | 적응형 난이도 퀴즈. 연속 정답 시 레벨 상승. |
| `teach` | Protege Effect | AI가 무지한 학생 역할. 학습자가 가르친다. |
| `explore` | 정교화 | 자유 Q&A, 요약, 비교, 마인드맵 |
| `gap` | 메타인지 | 지식 격차 진단 + 강점/약점 보고서 |

learn 명령의 결과에 `systemPrompt` 필드가 포함된다. 이 프롬프트의 역할과 행동 규칙을 따라 학습자와 대화를 진행한다. systemPrompt는 해당 학습 모드의 전문 튜터 역할을 정의하며, 반드시 그 지시사항을 준수해야 한다.

### 플래시카드 생성

```bash
echo '<JSON 배열>' | npx learnforge create-cards --deck "덱이름" --pretty
npx learnforge create-cards --file cards.json --pretty
```

카드 JSON 형식:
```json
[{"front": "질문", "back": "답변", "cardType": "basic", "tags": "태그1,태그2"}]
```

cardType: `basic`, `cloze`, `code`, `concept`

학습 세션 중 핵심 개념이 나오면 자연스럽게 카드 생성을 제안한다.

### 복습

```bash
npx learnforge review --pretty                    # 오늘 복습할 카드
npx learnforge review --deck "덱이름" --limit 10 --pretty
```

카드를 학습자에게 보여주고 응답을 받은 후:

```bash
npx learnforge answer <cardId> <rating> --pretty
```

rating: `1`=Again(모름), `2`=Hard(어려움), `3`=Good(적절), `4`=Easy(쉬움)

복습 세션에서는 카드의 front를 보여주고, 학습자가 답변한 후 back과 비교하여 적절한 rating을 함께 결정한다.

### 진행도

```bash
npx learnforge progress --pretty                              # 전체 개요
npx learnforge progress --type deck --pretty                   # 덱별 통계
npx learnforge progress --type heatmap --days 30 --pretty      # 30일 히트맵
npx learnforge progress --type gaps --pretty                   # 지식 격차
npx learnforge progress --type forecast --days 7 --pretty      # 7일 예측
```

### 내보내기

```bash
npx learnforge export --format tsv                 # Anki 호환
npx learnforge export --format csv
npx learnforge export --format json
npx learnforge export --format mochi_md            # Mochi 호환
npx learnforge export --format tsv --deck "덱이름"  # 특정 덱만
```

### 기타

```bash
npx learnforge sources --pretty    # 등록된 학습 자료 목록
npx learnforge status --pretty     # 시스템 상태
```

## 워크플로우

### 새 자료 학습

1. `ingest`로 자료 수집
2. `learn`으로 학습 세션 시작 — systemPrompt 역할을 따라 대화 진행
3. 핵심 개념을 `create-cards`로 카드화
4. `progress`로 진행도 확인

### 일일 복습

1. `review`로 오늘 복습할 카드 조회
2. 각 카드의 front를 보여주고 학습자의 답변을 받음
3. back과 비교 후 `answer`로 rating 기록
4. 모든 due 카드가 끝날 때까지 반복

### 학습 모드 자동 선택

사용자가 모드 이름을 모를 수 있다. 사용자의 의도에서 적절한 모드를 판단한다.

| 사용자 의도 (예시) | 모드 | 이유 |
|-------------------|------|------|
| "이해하고 싶어", "개념을 파악하고 싶어", "처음 배우는 건데" | `explore` | 자유 탐색으로 전체 그림 파악 |
| "깊이 이해하고 싶어", "왜 그런지 알고 싶어", "본질을 파헤치고 싶어" | `socratic` | 전략적 질문으로 깊은 통찰 유도 |
| "남들에게 설명할 수 있을 정도로", "완벽하게 이해하고 싶어", "내 말로 정리하고 싶어" | `feynman` | 자기 설명 + 4축 피드백으로 빈틈 발견 |
| "가르쳐주고 싶어", "누군가에게 설명하는 연습", "쉽게 풀어서 전달하고 싶어" | `teach` | 가르치기 효과로 설명력 강화 |
| "시험 준비", "퀴즈", "테스트", "얼마나 아는지 확인", "문제 내줘" | `quiz` | 적응형 퀴즈로 인출 연습 |
| "내 수준이 궁금해", "어디가 약한지", "뭘 모르는지 파악하고 싶어" | `gap` | 메타인지 진단 + 격차 리포트 |

복합적인 요청은 단계별로 분해한다. 예를 들어 "완벽하게 이해하고 암기한 뒤 남들에게 설명하고 싶어"라면:
1. `explore`로 전체 개념 파악
2. `feynman`으로 자기 설명 훈련
3. `create-cards`로 핵심 개념 카드화
4. `teach`로 설명 연습

이 경우 사용자에게 학습 로드맵을 제안하고, 첫 단계부터 시작한다.
