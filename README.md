# Real-time Markdown Converter (R.M.C.)

> Markdown을 입력하는 즉시 Preview와 HTML Source로 변환하는 서버리스 정적 웹앱입니다.

## 소개

R.M.C.는 개발자, 문서 작성자, 블로거가 Markdown 문서를 빠르게 작성하고 결과를 즉시 확인할 수 있도록 만든 정적 웹앱입니다. 별도 백엔드 없이 브라우저에서 동작하며, 작성 중인 문서는 LocalStorage에 자동 저장됩니다.

## 주요 기능

- **실시간 변환**: Markdown 입력과 동시에 Preview 및 HTML Source를 갱신합니다.
- **HTML Source 보기**: 변환된 HTML을 줄바꿈과 들여쓰기가 적용된 형태로 확인할 수 있습니다.
- **안전한 렌더링**: `marked`로 Markdown을 변환하고 `DOMPurify`로 HTML을 정제합니다.
- **상단 툴바**: `Export HTML`, `Export MD`, `Copy`를 제공합니다.
- **Markdown 복사**: 상단 `Copy`는 Markdown 원문을 복사하며, 성공 시 `Copied!`와 초록색 아이콘 피드백을 표시합니다.
- **파일 메뉴**: 새 문서 생성, MD/HTML 내보내기, 백업 복구를 지원합니다.
- **편집 메뉴**: 굵게, 기울임, 링크, 코드 블록 삽입과 HTML 복사를 지원합니다.
- **보기 메뉴**: 중복 항목을 제거하고 `Preview`, `HTML Source` 전환만 제공합니다.
- **JTech 이동 안내**: 우측 상단 GitHub 아이콘 클릭 시 임시 Markdown 안내 화면을 표시하고 2초 뒤 `https://jtech-co.github.io/`로 이동합니다. 이 임시 안내는 로컬에 저장되지 않습니다.
- **문서 보호**: 새 문서 생성 전 기존 내용을 백업하고, 백업 복구 기능을 제공합니다.

## 기술 스택

- **Frontend**: HTML5, CSS3, Vanilla JavaScript, ES Modules
- **UI**: Tailwind CSS CDN, Font Awesome, Google Fonts
- **Markdown**: marked 9.1.2
- **Security**: DOMPurify 3.0.6
- **Code Highlighting**: Highlight.js 11.9.0
- **Storage**: LocalStorage
- **Testing**: Node.js 정적 검사, Chrome DevTools Protocol 기반 E2E smoke test
- **Deployment**: GitHub Pages 또는 정적 호스팅

## 빠른 시작

### 요구 사항

- Node.js 18 이상 권장
- E2E 검증 시 Chrome 또는 Edge 필요

### 설치

```bash
npm install
```

### 실행

```bash
npm run dev
```

기본 개발 서버는 `http://127.0.0.1:8000/index.html`에서 실행됩니다.

### 검증

```bash
npm run check
npm run check:e2e
npm run check:all
```

Windows PowerShell에서 `npm.ps1` 실행 정책 오류가 발생하면 다음처럼 `npm.cmd`를 사용합니다.

```bash
npm.cmd run check:all
```

Chrome 또는 Edge가 기본 경로에 없으면 `RMC_CHROME_PATH`로 브라우저 경로를 지정할 수 있습니다.

```bash
RMC_CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

## 프로젝트 구조

```text
.
|-- index.html              # 앱 진입점 및 UI 구조
|-- css/                    # 화면 스타일
|-- js/
|   |-- main.js             # 앱 상태, 이벤트, 메뉴/툴바 액션
|   |-- markdown.js         # Markdown 변환 및 sanitize 경계
|   |-- preview.js          # Preview와 HTML Source 렌더링
|   |-- sourceFormatter.js  # HTML Source 줄바꿈/들여쓰기 포맷터
|   |-- export.js           # HTML/Markdown 내보내기 및 클립보드 복사
|   |-- storage.js          # LocalStorage 저장, 백업, 복구
|   |-- autoSave.js         # 자동 저장 및 임시 화면 저장 방지
|   |-- scrollSync.js       # 에디터와 미리보기 스크롤 동기화
|   |-- editor.js           # 글자 수와 커서 위치 계산
|   |-- ui.js               # Toast와 탭 상태 UI
|   `-- config.js           # 기본 문서와 상수
|-- scripts/
|   |-- check.js            # 정적 프로젝트 검증
|   `-- e2e-smoke.js        # Headless 브라우저 smoke test
|-- docs/
|   `-- deployment.md       # 배포 및 유지보수 메모
|-- package.json
`-- package-lock.json
```

## 동작 메모

- 상단 `Copy`는 Markdown 원문을 복사합니다.
- Edit 메뉴의 `Copy HTML`은 렌더링된 HTML을 복사합니다.
- `Export HTML`과 `Export MD`는 클릭 성공 시 아이콘이 잠시 초록색으로 바뀝니다.
- GitHub 아이콘 클릭 시 표시되는 JTech 안내 Markdown은 임시 보기용이며 자동 저장 대상이 아닙니다.
- 배포 관련 세부 메모는 [docs/deployment.md](docs/deployment.md)를 참고합니다.

## 정보

- **Version**: 1.1.0
- **License**: MIT
