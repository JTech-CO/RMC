# R.M.C. 리팩터링 검토 기록

> 아래는 2.0.0 리팩터링의 이력입니다. 후속 2.0.1 UI 변경은 [UI-UPDATE-KR.md](UI-UPDATE-KR.md), 현재 검증 결과는 [QA-REPORT.md](QA-REPORT.md)를 확인합니다.

작성일: 2026-09-06  
원본: `https://github.com/JTech-CO/RMC`  
검토 기준: `main` 트리 `748248cb3401b9142f5dbef1274c2bc044011cec` / package version `1.1.0`  
산출물: 원격에 반영하지 않은 `2.0.0` 전체 소스 인계본

## 1. 결론

CSS가 오래되었다는 사실 자체를 결함으로 보지 않았다. 실제 원본을 읽은 결과, 개별 CSS 파일보다 `index.html` 안의 Tailwind Play CDN 설정·유틸리티 클래스가 화면 구현의 대부분을 담당했다. 따라서 몇 개 CSS 선언을 바꾸는 작업으로 끝내지 않고, 정적 CSS와 의미 있는 컴포넌트 클래스로 화면 구조를 정리했다. 다크모드·Markdown 원문·미리보기·HTML 소스·복사·내보내기·로컬 저장이라는 제품의 중심은 유지했다.

원본 코드는 GitHub 연결을 통해 읽었다. 실제 원본 브라우저에서 모든 결함을 재현한 것은 아니며, 아래의 원본 판단은 **정적 코드 검토**와 라이브러리 공식 문서에 근거한다. 변경본의 실행 검증은 별도의 QA 보고서와 결과 파일에 구분했다. 원본 CSS의 최종 수정이 정확히 8개월 전인지 독립적으로 확정하지 않았으며, 그 기간을 변경의 유일한 근거로 삼지 않았다.

## 2. 확인한 문제와 수정

| 원본 위치 | 확인한 경로 또는 위험 | 변경본 처리 | 검증 형태 |
| --- | --- | --- | --- |
| `index.html` | Tailwind Play CDN에서 실행 시 스타일 생성, 대형 인라인 설정, 외부 폰트·아이콘 CSS 의존 | 정적 CSS 4개, 디자인 토큰, 로컬 SVG, 시스템 폰트 | 구조 검사·데스크톱/모바일 컴포넌트 화면 |
| `js/export.js` | `execCommand('copy')` 반환값이 false여도 성공 토스트·true 반환 | 반환값 엄격 확인, 권한 거부 시 실패 안내, 포커스·선택 복원 | Node mock + 브라우저 컴포넌트 실패 경로 |
| `js/main.js` | 렌더 실패 후 `currentHtml = ''`인 상태로 HTML 다운로드를 계속 호출 | 오류와 정상 빈 문서를 구분, 최신 revision의 성공 결과에서만 HTML 동작 활성화 | 제한 초과 실패 경로, HTML 비활성·MD 활성 확인 |
| `js/sourceFormatter.js` | 코드의 마지막 LF를 제거하고 들여쓰기 추가, 인라인 공백 축약 | 포매터 제거, 정제된 실제 HTML 문자열을 그대로 소스 표시 | 코드 공백·소스 동일성 컴포넌트 검사 |
| `js/autoSave.js`, `main.js` | 1초 타이머 중심 저장, 페이지 이탈 저장 처리가 없음 | 500 ms debounce, pagehide/visibilitychange/beforeunload에서 flush | 순수 저장·타이머 검사; 실제 강제종료 보장은 하지 않음 |
| `js/storage.js`, `autoSave.js` | 저장 실패는 반환하지만 사용자에게 지속적인 경고를 제공하지 않음 | 명확한 저장 상태·경고, 저장/백업 실패 시 교체 중단 | 저장 거부·할당량·손상 레코드 Node 검사 |
| `js/main.js` restore | 현재 문서를 확인·별도 백업하지 않고 복구 내용으로 교체 | 확인 후 현재 문서를 복구 슬롯에 보관, 빈 백업도 유효 | New/Cancel/Restore 및 빈 레코드 검사 |
| `js/main.js` navigation | 홈 이동 전 실제 에디터 값을 임시 안내로 바꾸고 지연 이동 | 일반 새 탭 링크로 변경, 편집 문서 비변경 | 코드 검토; 외부 사이트 이동 자체는 미검증 |
| `js/main.js` input | 입력 때마다 전체 파싱·DOM·하이라이트 즉시 수행 | 입력 debounce, IME 조합 처리, Worker 파서·제한·stale revision 제거 | Worker 본문 로직을 사용한 격리 검사; 실제 Worker 스레드는 미검증 |
| `index.html`, `ui.js` | 제한적인 메뉴 키보드 동작, div 기반 확인창, 입력 이름 부족 | native dialog, 메뉴 방향키·Escape, 탭 ARIA, 레이블, 모바일 아이콘 이름 | 포커스·메뉴·탭·구분선 컴포넌트 검사 |
| `js/export.js` | object URL을 click 직후 revoke | 30초 후 정리, 다운로드 완료로 오해하지 않는 안내 | 생성 HTML·모의 다운로드 검사; 실제 OS 저장은 미검증 |

기존 코드가 이미 DOMPurify를 사용했다는 점을 유지·발전시켰으며, 원본이 무조건 임의 스크립트를 실행한다고 단정하지 않는다. 보안 라이브러리 버전과 허용 범위를 정리하고 모든 출력 경로가 동일한 정제 결과를 쓰도록 했다.

## 3. 구조와 의존성 변경

원본 렌더러는 Marked 9.1.2, DOMPurify 3.0.6, highlight.js 11.9.0으로 고정되어 있었다. 변경 구성은 Marked 18.0.11, DOMPurify 3.4.14, highlight.js 11.12.0이다. 마지막 버전은 highlight.js 공식 사이트·릴리스 목록을 확인하여 선택했다. 일부 CDN 목록의 갱신 시점과 공식 버전 표기가 달랐으므로 기본 자산 URL은 공식 사용 예시를 기준으로 두었고, 실제 자산 다운로드 검증은 미완료 항목으로 명시했다.

런타임 설정은 `js/runtime-urls.js`로 모으고 `npm run vendor`로 동일 버전 로컬 배포를 준비할 수 있게 했다. 라이브러리 파일은 이번 ZIP에 실제로 내려받아 포함하지 못했다. 다운로드 스크립트와 실제 브라우저 검증을 포함했다고 해서 다운로드 성공이나 실배포 검증이 완료되었다고 표현하지 않는다.

기존 `live-server`·`http-server` 개발 의존성은 Node 내장 HTTP 서버와 검사 스크립트로 대체했다. `package-lock.json`도 새 구성에 맞춘다. npm 의존성이 없다는 사실은 CDN 라이브러리에 보안 검토가 필요 없다는 의미가 아니다.

## 4. 의도적으로 달라진 동작

| 항목 | 변경 이유 |
| --- | --- |
| HTML Source는 미화 정렬하지 않음 | 보이는 문자열을 복사했을 때 코드 공백·의미가 달라지는 문제 방지 |
| 기본 외부 이미지 차단 | 작성·붙여넣기만으로 외부 서버에 요청이 나가는 것을 줄임. 설정에서 HTTPS 이미지 허용 |
| HTML 내보내기도 다크 스타일 | 미리보기와 출력의 시각적 일관성. 인쇄에만 라이트 스타일 |
| GitHub/JTech 일반 링크 | 이동 안내를 위해 사용자의 에디터를 임시 변조하지 않음 |
| 직전 문서 1개 백업 | 작은 정적 도구의 범위를 유지. 전체 히스토리나 다중 문서 서비스로 확장하지 않음 |
| 모바일 단일 패널 전환 | 키보드와 작은 화면에서 기존 상하 반분 패널의 좁은 작업 공간 개선 |
| 입력·파싱 크기 제한 | 무제한 문서를 무조건 렌더하는 대신, 원문 내보내기를 유지하며 실패 상태를 명확화 |
| 스타일·ID·임의 클래스 제한 | 붙여넣은 HTML이 앱 UI 스타일이나 DOM 이름을 침범하지 않도록 범위 축소 |

## 5. 남은 검증 및 한계

실제 HTTP 브라우저 실행은 관리 정책으로 차단되었다. 확인한 35개 브라우저 항목은 **구버전 호환성 fixture + 실제 앱 코드 + 모의 Worker/저장/다운로드 환경**의 컴포넌트 검사다. 실제 배포용 최신 의존성, 네트워크 로딩, CSP, Worker 격리, 실제 파일 다운로드·시스템 클립보드는 별도로 검증해야 한다. 정책을 무력화하는 우회는 하지 않았다.

원본 문제를 개선했다고 해서 보안 취약점이 전혀 없다고 판정하지 않는다. main-thread 정제·하이라이팅 자원 소모, 매우 동시적인 localStorage 쓰기 경쟁, 강제 종료 시 최근 입력 유실, iOS 키보드와 Safari·Firefox·스크린 리더 지원은 남은 검토 범위다. 실제 배포 전 `npm run vendor`와 `npm run test:browser`를 통과시키고 수동 점검을 수행한다.

## 6. 근거 자료

확인일: 2026-09-06. 원본 파일 링크는 검토한 트리 기준으로 고정했다.

- [원본 index.html](https://github.com/JTech-CO/RMC/blob/748248cb3401b9142f5dbef1274c2bc044011cec/index.html)
- [원본 main.js](https://github.com/JTech-CO/RMC/blob/748248cb3401b9142f5dbef1274c2bc044011cec/js/main.js)
- [원본 export.js](https://github.com/JTech-CO/RMC/blob/748248cb3401b9142f5dbef1274c2bc044011cec/js/export.js)
- [원본 sourceFormatter.js](https://github.com/JTech-CO/RMC/blob/748248cb3401b9142f5dbef1274c2bc044011cec/js/sourceFormatter.js)
- [Tailwind Play CDN: 개발용 사용 안내](https://tailwindcss.com/docs/installation/play-cdn)
- [Marked: 보안 주의사항](https://marked.js.org/)
- [Marked: Worker 사용과 고급 옵션](https://marked.js.org/using_advanced)
- [Marked 릴리스](https://github.com/markedjs/marked/releases)
- [DOMPurify 릴리스](https://github.com/cure53/DOMPurify/releases)
- [highlight.js 공식 사용 예시](https://highlightjs.org/)
- [highlight.js 릴리스](https://github.com/highlightjs/highlight.js/releases)
