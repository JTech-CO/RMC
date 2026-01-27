# Real-time Markdown Converter (R.M.C.)

> **마크다운을 실시간으로 HTML로 변환하고, 미리보기·다운로드·클립보드 복사를 지원하는 웹 기반 도구**

## 1. 소개 (Introduction)

이 프로젝트는 마크다운을 실시간으로 HTML로 변환하여 미리보기하고, 완성된 HTML·마크다운을 다운로드하거나 클립보드에 복사할 수 있게 하기 위한 **클라이언트 전용 웹 애플리케이션**입니다.
**별도 설치·서버 없이 브라우저에서 바로 사용**할 수 있으며, IDE 스타일의 고대비 UI와 LocalStorage 자동 저장을 통해 사용자에게 **즉시 활용 가능한 원스톱 생산성 도구**를 제공합니다.

**주요 기능**
- **실시간 변환**: 좌측 에디터 입력 즉시 우측 미리보기에 HTML 렌더링
- **스크롤 동기화**: 에디터와 미리보기 패널 간 스크롤 비율 동기화
- **내보내기**: HTML·마크다운 파일 다운로드, HTML 클립보드 복사
- **자동 저장**: LocalStorage에 주기적 저장, 새로고침 시 내용 복구

## 2. 기술 스택 (Tech Stack)

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla ES6+ 모듈)
- **UI**: Tailwind CSS (CDN), Font Awesome, Google Fonts (Noto Sans KR, JetBrains Mono)
- **Markdown**: [marked.js](https://marked.js.org/) (GFM, 테이블 등 지원)
- **보안**: [DOMPurify](https://github.com/cure53/DOMPurify) (HTML Sanitization, XSS 방지)
- **코드 하이라이트**: [Highlight.js](https://highlightjs.org/)
- **Deployment**: GitHub Pages 등 정적 호스팅 (추가 빌드 불필요)

## 3. 설치 및 실행 (Quick Start)

**요구 사항**: 최신 브라우저 (Chrome, Firefox, Safari, Edge 등). Node.js 불필요.

1. **저장소 클론**
   ```bash
   git clone https://github.com/[사용자명]/[레포지토리명].git
   cd [레포지토리명]
   ```

2. **실행 (Run)**
   - **로컬**: `index.html`을 브라우저에서 직접 열기  
   - **로컬 서버** (선택): `npx serve .` 등으로 루트에서 서빙 후 접속  
   - **GitHub Pages**: 레포 설정 → Pages → Source를 해당 브랜치/폴더로 지정 후 배포 [실행하기](<https://jtech-co.github.io/RMC/index.html>)

3. **환경 변수**
   - 사용하지 않음. CDN 기반으로 동작합니다.

## 4. 폴더 구조 (Structure)

```text
.
├── index.html          # 진입점 (Tailwind, 외부 라이브러리, 메인 로직 로드)
├── css/
│   ├── styles.css      # 공통 스타일 (body, selection 등)
│   ├── scrollbar.css   # 스크롤바
│   ├── editor.css      # 에디터 영역
│   └── preview.css     # 미리보기 패널
└── js/
    ├── main.js         # 초기화 및 이벤트 핸들러
    ├── config.js       # 상수·설정 (기본 마크다운, 저장 키 등)
    ├── storage.js      # LocalStorage 읽기/쓰기
    ├── editor.js       # 글자 수·커서 위치 등 에디터 유틸
    ├── preview.js      # 마크다운 → HTML 변환·렌더링
    ├── scrollSync.js   # 에디터–미리보기 스크롤 동기화
    ├── autoSave.js     # 자동 저장
    ├── export.js       # HTML/MD 다운로드·클립보드 복사
    └── ui.js           # 뷰 모드 토글·토스트 등 UI
```

## 5. 정보 (Info)

- **License**: MIT
