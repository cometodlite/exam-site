# 대학 시험 대비 문제 사이트

7개 과목(AI기반전자공학첫걸음, 기초코딩과문제해결, 심화글쓰기, 이산수학, 진로탐색세미나, 컴퓨터구조, 컴퓨터프로그래밍)의
객관식 문제를 풀어볼 수 있는 정적 웹사이트입니다. 빌드 과정 없이 순수 HTML/CSS/JS로 동작하며, GitHub Pages로 바로 배포할 수 있습니다.

## 구조

```
exam-site/
├── index.html          # 과목 선택 화면
├── quiz.html            # 문제 풀이 화면
├── css/style.css
├── js/app.js
└── data/
    ├── subjects.json           # 과목 목록 (id, 이름, 문제 파일명)
    ├── ai-electronics.json
    ├── coding-basics.json
    ├── writing.json
    ├── discrete-math.json
    ├── career-seminar.json
    ├── computer-architecture.json
    └── programming.json
```

## 문제 추가/수정하는 법

1. `data/` 폴더의 해당 과목 JSON 파일을 연다.
2. 아래 형식으로 문제를 추가/수정한다.

```json
{
  "question": "문제 내용",
  "options": ["보기1", "보기2", "보기3", "보기4"],
  "answer": 0,
  "explanation": "정답 해설 (선택 사항)"
}
```

- `answer`는 정답 보기의 인덱스(0부터 시작)입니다.
- 새 과목을 추가하려면 `data/subjects.json`에 `{ "id": "...", "name": "...", "file": "새파일.json" }`을 추가하고, 같은 이름의 JSON 파일을 `data/` 폴더에 만들면 됩니다.

## 로컬에서 미리보기

파일을 직접 브라우저로 열면 `fetch`가 로컬 파일 접근 문제로 막힐 수 있으므로, 간단한 로컬 서버로 실행하세요.

```bash
cd exam-site
python3 -m http.server 8000
```

그 후 브라우저에서 `http://localhost:8000` 접속.

## GitHub Pages로 배포하기

1. GitHub에 새 저장소를 만든다 (예: `exam-site`).
2. 이 폴더 내용을 저장소에 push 한다.

```bash
git init
git add .
git commit -m "Initial exam site"
git branch -M main
git remote add origin https://github.com/<사용자명>/<저장소명>.git
git push -u origin main
```

3. GitHub 저장소 → **Settings → Pages** 로 이동.
4. **Source**를 `Deploy from a branch`로 설정하고, Branch를 `main` / `/(root)`로 선택 후 저장.
5. 잠시 후 `https://<사용자명>.github.io/<저장소명>/` 주소로 사이트가 배포됩니다.
