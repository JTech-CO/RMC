# Real-time Markdown Converter (R.M.C.)

> **마크다운을 입력하는 즉시 HTML 미리보기와 소스 코드로 변환하는 서버리스 정적 웹앱**

## 1. 소개 (Introduction)

R.M.C.는 문서 작성자, 개발자, 블로거가 마크다운을 빠르게 작성하고 변환 결과를 즉시 확인할 수 있도록 만든 웹 애플리케이션입니다. 별도 백엔드 없이 브라우저에서 동작하며, 입력 내용은 로컬 저장소에 자동 저장됩니다.

**주요 기능**
- **실시간 변환**: 마크다운 입력과 동시에 미리보기와 HTML Source를 갱신합니다.
- **안전한 렌더링**: `marked`로 변환한 HTML을 `DOMPurify`로 정제해 미리보기에 반영합니다.
- **작업 보호**: 새 문서 시작 전 확인 다이얼로그를 표시하고, 기존 내용을 백업/복구할 수 있습니다.
- **내보내기**: HTML 파일, Markdown 파일, HTML 클립보드 복사를 지원합니다.
- **편집 보조**: File/Edit/View 메뉴에서 굵게, 기울임, 링크, 코드 블록 삽입과 보기 전환을 제공합니다.

## 2. 기술 스택 (Tech Stack)

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES Modules)
- **UI**: Tailwind CSS CDN, Font Awesome, Google Fonts
- **Markdown**: marked 9.1.2
- **Security**: DOMPurify 3.0.6
- **Code Highlighting**: Highlight.js 11.9.0
- **State Management**: LocalStorage
- **Testing**: Node.js 기반 정적 검사, Chrome DevTools Protocol 기반 E2E 스모크 테스트
- **Deployment**: GitHub Pages 또는 정적 호스팅

## 3. 설치 및 실행 (Quick Start)

**요구 사항**: Node.js 18 이상 권장

1. **설치 (Install)**
   ```bash
   git clone [레포지토리 URL]
   cd Real-time-Markdown-Converter
   npm install
   ```

2. **환경 변수 (Environment)**
   별도 `.env` 파일은 필요하지 않습니다.  
   Chrome 또는 Edge가 기본 위치에 없으면 E2E 검증 시 `RMC_CHROME_PATH`를 지정할 수 있습니다.

   ```bash
   # 예시
   RMC_CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
   ```

3. **실행 (Run)**
   ```bash
   npm run dev
   ```

4. **검증 (Check)**
   ```bash
   npm run check
   npm run check:e2e
   npm run check:all
   ```

   Windows PowerShell에서 `npm.ps1` 실행 정책 오류가 발생하면 `npm.cmd run check:all`처럼 `npm.cmd`를 사용합니다.

## 4. 폴더 구조 (Structure)

```text
.
├── index.html              # 앱 진입점
├── css/                    # 화면 스타일
├── js/
│   ├── main.js             # 앱 상태와 이벤트 연결
│   ├── markdown.js         # 마크다운 변환 및 sanitize 경계
│   ├── preview.js          # 미리보기와 HTML Source 렌더링
│   ├── sourceFormatter.js  # HTML Source 줄바꿈/들여쓰기 포맷터
│   ├── export.js           # HTML/Markdown/클립보드 내보내기
│   ├── storage.js          # LocalStorage 저장/백업/복구
│   ├── autoSave.js         # 자동 저장
│   ├── scrollSync.js       # 에디터/미리보기 스크롤 동기화
│   ├── editor.js           # 글자 수와 커서 위치 계산
│   ├── ui.js               # 탭, 토스트, 저장 상태 UI
│   └── config.js           # 기본 문서와 상수
├── scripts/
│   ├── check.js            # 정적 프로젝트 검증
│   └── e2e-smoke.js        # Headless 브라우저 스모크 테스트
├── docs/
│   └── deployment.md       # 배포 및 의존성 메모
├── package.json
└── package-lock.json
```

## 5. 정보 (Info)

- **Version**: 1.1.0
- **License**: MIT