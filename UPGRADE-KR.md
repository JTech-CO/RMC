# RMC 2.0.2 — 기존 저장소 적용 방법

이 패키지는 원격 저장소를 자동 수정하지 않습니다. 기존 2.0.1의 UI 가독성·각진 디자인·문서 스타일·초안 저장 키를 유지한 정적 배포 보완본입니다.

## 가장 먼저 확인할 것

GitHub Pages는 계속 사용할 수 있습니다. 확인한 `4660cf6` 커밋의 Pages 배포는 성공했지만, 별도 CI는 구버전 `js/preview.js`가 없는 `sourceFormatter.js`를 참조해서 실패했습니다. CSS 깨짐의 가장 유력한 설명은 새 HTML/이전 CSS의 혼용입니다. 사용자 브라우저의 실제 CSS 응답·캐시 헤더는 확보하지 못했으므로 캐시 원인 확정 판정은 아닙니다.

우선 현재 사이트에서 Ctrl+Shift+R로 강력 새로고침을 해 보십시오. 그래도 같으면 F12 → Network → Disable cache를 켠 상태에서 새로고침한 뒤 `styles.css` 응답을 확인합니다. **사이트 데이터·LocalStorage를 삭제하지 마십시오. 초안이 함께 삭제될 수 있습니다.**

## 기존 프로젝트에 적용

1. 중요한 초안을 Markdown으로 내보내고 저장소 작업을 별도로 백업합니다. ZIP의 `RMC/` 폴더 자체가 아닌 **그 안의 내용물**을 기존 저장소 루트에 반영합니다. `.git/`, `CNAME`, 개인 환경 파일은 보존합니다. `.github`, `.nojekyll`, `.gitattributes`도 포함합니다.
2. 저장소 루트에서 다음을 실행합니다. Node.js 22 이상이 필요하며, 이 단계에 `npm install`은 필요 없습니다.

```powershell
npm.cmd run migrate
npm.cmd run migrate -- --apply
npm.cmd run check:all
```

`migrate`만 실행하면 사전 점검입니다. `--apply`는 알려진 원본과 내용이 같은 구버전 파일만 저장소 바깥의 `.RMC-legacy-backup-<timestamp>`로 옮깁니다. 수정된 파일은 자동으로 옮기지 않고 `REVIEW REQUIRED`를 표시합니다. 새 파일로 덮어쓰기만 해서는 구버전 파일이 삭제되지 않습니다.

대상 경로: `js/autoSave.js`, `js/preview.js`, `js/scrollSync.js`, `js/sourceFormatter.js`, `css/scrollbar.css`, `scripts/check.js`, `scripts/e2e-smoke.js`. 없는 파일은 무시합니다. 현재 사용하는 `js/scroll-sync.js`는 제거 대상이 아닙니다.

3. `git status`와 `git diff --stat`로 수정·삭제 목록을 확인한 뒤 해당 변경을 커밋하고 `main`에 푸시합니다. 이 문서는 무관한 미커밋 파일까지 자동으로 스테이징하지 않습니다.
4. **기존처럼 브랜치 배포를 쓰는 경우** Settings → Pages → Build and deployment에서 Source=`Deploy from a branch`, Branch=`main`, Folder=`/(root)`로 둡니다. 이 복구를 위해 GitHub Actions 배포로 전환할 필요는 없습니다.
5. Pages 배포 성공 후 Ctrl+Shift+R로 다시 열어 상단 버전 `2.0.2`를 확인합니다.

## 공개 배포 파일 점검

다음은 읽기 전용 점검으로, 서버를 실행하거나 사이트를 변경하지 않습니다.

```powershell
npm.cmd run check:deployment -- https://jtech-co.github.io/RMC/
```

`index.html`, `release.json`, CSS·JS·SVG의 HTTP 상태·MIME·릴리스 일치·해시를 확인합니다. 현재 배포본과 로컬 패키지의 바이트가 다르면 경로를 출력합니다. 이 HTTP 검사가 통과했다고 브라우저 실행·CDN 라이브러리·클립보드·Worker 검증까지 끝난 것은 아닙니다.

## 무엇이 바뀌었는가

- CSS/메인 JS만이 아니라 ES 모듈 내부 import, Worker URL, 내보내기용 CSS 요청까지 `?v=2.0.2`로 분리했습니다.
- CSS가 없더라도 UI SVG가 거대하게 표시되지 않도록 자체 크기·선 속성을 넣었습니다.
- CSS 누락/버전 불일치와 앱 JS 초기화 실패를 구분해 알려 주는 독립 부팅 점검 스크립트를 넣었습니다. 해당 JS 자체도 차단되는 경우에는 안내를 표시할 수 없습니다.
- 구버전 잔존 파일을 명시적으로 검출하고 안전한 이관 스크립트를 제공합니다.
- `/RMC/` 접두경로를 갖는 실제 로컬 HTTP 응답도 검증합니다.

## 주의

이번 ZIP도 기존과 같이 **CDN 렌더링 의존성을 사용하는 구성**입니다. 이번 변경으로 외부 라이브러리를 오프라인으로 포함했다고 주장하지 않습니다. CSS·JS 파일 호스팅에 별도 백엔드나 Vite 빌드는 필요하지 않습니다. `npm run dev`는 개발 PC에서만 사용하는 테스트 서버입니다.

직접 수정한 CSS·JS를 배포할 때에는 패키지 버전을 올린 뒤 `npm run release:stamp`로 전체 참조와 `release.json`을 갱신합니다. 라이브러리를 직접 호스팅하려면 네트워크가 가능한 환경에서 `npm run vendor`를 실행하고 생성된 파일·라이선스·해시 및 실제 브라우저 동작을 확인해야 합니다. 해당 다운로드는 이번 환경에서 검증하지 못했습니다.
