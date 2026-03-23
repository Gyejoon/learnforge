# OpenClaw

LearnForge는 OpenClaw에서 `CLI + 스킬` 조합으로 사용하는 것이 가장 안정적입니다.

## 권장 설치

```bash
git clone https://github.com/Gyejoon/learnforge.git
cd learnforge
npm install
npx learnforge setup --target openclaw
```

이 명령은 다음을 처리합니다.

- `~/.learnforge/learnforge.db` 생성
- `~/.learnforge/bin/learnforge` wrapper 생성
- `~/.openclaw/skills/learnforge/SKILL.md` 설치
- OpenClaw CLI가 있으면 스킬 인식 가능 여부 확인

OpenClaw CLI가 아직 없으면 setup은 경고를 출력하고 DB/wrapper 준비까지만 완료합니다. OpenClaw 설치 후 같은 명령을 다시 실행하면 됩니다.

> wrapper는 현재 저장소의 `dist/cli.js`를 가리킵니다. 저장소 위치를 옮기거나 새 checkout으로 바꿨다면 `setup`을 다시 실행하세요.

## OpenClaw에서 사용

설정이 끝나면 OpenClaw 대화에서 자연어로 바로 사용할 수 있습니다.

- "이 PDF 학습하자"
- "복습하자"
- "카드 만들어줘"
- "진행도 보여줘"
- "Anki로 내보내기"

또는 직접 CLI를 호출할 수도 있습니다.

```bash
~/.learnforge/bin/learnforge ingest "https://example.com/article"
~/.learnforge/bin/learnforge review --pretty
~/.learnforge/bin/learnforge answer <card-id> 3
~/.learnforge/bin/learnforge progress --type overview --pretty
~/.learnforge/bin/learnforge export --format tsv --deck math
```

## 수동 설치

setup 없이 직접 넣고 싶다면 공용 스킬 원본을 OpenClaw skills 디렉터리로 복사하면 됩니다.

```bash
mkdir -p ~/.openclaw/skills/learnforge
cp /path/to/learnforge/skills/learnforge/SKILL.md ~/.openclaw/skills/learnforge/SKILL.md
```

복사 후 `{{LEARNFORGE_BIN}}`를 `~/.learnforge/bin/learnforge` 또는 원하는 실행 경로로 치환해야 합니다.
