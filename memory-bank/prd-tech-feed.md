## 2026-09-24 승인 — 새로 발견한 글의 표시와 수집 완료

- `최신` 및 `저장` 목록은 원문 발행일이 아니라 서버의 최초 발견 시각(`discovered_at`)과 ID로 내림차순 정렬·페이지 이동한다. 과거 발행 글을 새로 찾았을 때도 앞쪽에서 발견할 수 있어야 한다.
- 카드에는 `발견` 시각과 확인 가능한 경우 `원문 발행` 시각을 구분해 표시한다. 오늘 수집 통계는 기존 최초 발견 시각 기준을 유지한다. 중복 URL을 다시 조회한 일은 새 발견으로 가장하지 않는다.
- 정기 및 수동 수집의 완료/lease는 기사 발견·저장 결과를 기준으로 확정한다. 부가 번역·썸네일/영상 확인은 완료 후 독립된 시간 제한으로 실행하고, 그 실패가 새 글 확인 결과를 가리지 않게 한다.
- 무료 검색·번역/AI 한도, 공개 RSS 승인 상태, 출처 권한, 저장·할 일 연결은 변경하지 않는다. 브라우저가 닫힌 정시 수집과 수동 새 글 확인 모두 회귀 검증한다.

## 2026-09-23 승인 — 기술 피드 정보 위계와 반응형 폭

- 넓은 PC에서 피드가 880px에 묶여 오른쪽 공백이 커지지 않도록 피드 전용 작업 영역을 확장한다. 다른 대시보드 화면의 너비는 유지한다.
- 피드는 최대 1800px의 중앙 캔버스를 사용하고, 1400px 이상에서는 기사 목록을 2열로, 좁은 화면과 모바일에서는 1열로 표시한다. 긴 글의 읽기 폭과 375px 가로 넘침을 확인한다.
- 오늘 브리핑에는 수집 건수·출처 수·주요 주제 3개와 꼭 볼 글을 먼저 보여준다. 콘텐츠 유형·전체 주제와 상세 인사이트는 키보드로도 열 수 있는 접기 영역에 둔다.
- 필터·저장·원문·할 일 추가·AI 생성·계정별 데이터·API·DB 동작은 바꾸지 않는다.

## 2026-09-23 요구사항 추가 — 원문 언어와 한국어 기술 글

- 기사 카드 해시 태그에 번역된 화면 언어가 아닌 원문 제목·소개에서 판별한 언어를 표시한다. 한국어/영어 근거가 부족하거나 다른 문자는 `원문 언어 미확인`으로 둔다.
- 최신·저장 목록에서 `전체 / 한국어 원문 / 영어 원문`을 바로 선택한다. 필터는 사용자에게 조회 가능한 전체 글을 대상으로 페이지를 만들기 전에 적용하고, 주제·출처 필터와 함께 쓴다. 계정 변경 시 초기화한다.
- 한국어로 작성된 글은 원문을 그대로 표시하고 번역 대기 문구를 붙이지 않는다. 영어 원문의 한국어 자동 번역은 기존대로 구분해 보여준다.
- 관심 주제 검색은 순환 중 한국어 기술 구현 사례와 실무 가이드를 검색한다. 기존 1회 검색 요청·무료 한도·출처 승인·본문 비크롤링 규칙은 유지한다. 검색 결과의 언어·건수는 공급자 응답에 따라 달라진다.

## 2026-09-21 승인 — 오늘의 기술 피드 하이라이트

- 기존 오늘 브리핑의 명시적 AI 요청 한 번에서 인사이트와 함께 최대 3개 글을 선정한다. 별도 추천 호출, 추가 Cron, 유료 모델 전환은 만들지 않는다.
- 추천 대상은 오늘 수집된 조회 권한이 있는 실제 기사 중 분석 표본으로 제한한다. 근거가 부족하면 0개가 정상이며 필수 개수를 채우려고 지어내지 않는다.
- AI는 기사 ID와 추천 이유/배울 점만 반환한다. 제목과 원문 링크는 서버의 검증된 기사에서 구성하고 모델이 만든 URL을 사용하지 않는다.
- 첫 추천은 강조 카드로, 나머지는 보조 카드로 기존 브리핑 안에 표시한다. 캐시를 재사용하되 조회 시 출처 권한과 구조를 다시 검증하고 계정 전환/오류 시 이전 추천이 남지 않게 한다.
- 현재 공유 예산 15회/일, 실제 전송 상한 40회/일, 워커 12회 제한을 유지한다. 본 변경은 글 장르 분류용 별도 AI 도입 승인이 아니다.
- 실제 구현·검증·배포 결과는 progress.md 및 docs/session-plan/verification.md에 기록한다.

## 2026-09-15 승인 — 목록형(roundup) 콘텐츠 규칙 필터 (1단계, AI 미사용)

- 사용자가 실제 사례(zencoder.ai/blog/ai-blogs-for-developers-engineers, 'Top AI Blogs Every Software Developer Must Follow in 2026')를 근거로 AI 검토를 제안했다. 조사 결과 규칙 분류기의 오탐(발췌문의 'tutorials' 단어만으로 practice로 오분류)이 근본 원인이었고, 예산(하루 15회, 워커 12회)으로는 매 수집 글(하루 약 30건)마다 별도 AI 검토를 추가할 여유가 없어 사용자가 규칙 기반 1단계만 승인했다.
- 제목(URL 아님, 발췌문도 아님) 기반 목록형 판정을 추가한다: '~blogs/newsletters/podcasts를 꼭 팔로우/구독하라'류 영어·한국어 패턴. 발췌문은 검사하지 않아 '뉴스레터 구독' 같은 문구가 실제 기술 설명 안에 우연히 섞여도 오탐하지 않는다.
- 적용 지점 3곳: (1) 규칙 분류기가 목록형 제목을 news/practice/deep_dive로 분류하지 않음(AI가 이미 검증한 카테고리는 덮어쓰지 않음) (2) 웹 검색 수집 시점에 목록형 제목의 글 자체를 수집하지 않음 (3) 일일 브리핑 분석 표본에서 제외.
- 분류 규칙 버전을 2로 올려 기존에 잘못 분류된 글도 다음 정시 수집 때 자동 재분류되도록 했다(기존 자체 보정 메커니즘 재사용, 별도 데이터 수정 없음).
- AI 기반 2단계(기존 요약 호출에 장르 판단 필드를 얹는 방식)는 이번 승인 범위가 아니며, 사용자가 별도로 요청하면 진행한다.


## 2026-09-15 승인 개정 — AI 호출 예산 재조정과 실패 환급

- 사용자 승인으로 공유 일일 AI 예산을 **6회 → 15회**로 올린다. 아래 2026-09-12 기록의 `six actual calls/user/day`와 daily-briefing-design의 6회 유지 조항을 대체한다.
- 근거: 6은 2026-09-06 커리어 코치 시절 `coaching_private.reserve_ai`에 근거 주석 없이 들어간 자체 값이며 OpenRouter가 건 제한이 아니다. OpenRouter 무료 한도는 하루 50회(크레딧 $10 충전 시 1,000회)다. 하루 수집 30~36건을 호출당 3건으로 처리하려면 10회가 필요한데 예산이 6이어서 구조적으로 밀렸다.
- 예산 분리: 예약 수집 워커는 **최대 12회**까지만 쓰고 나머지 3회는 사용자의 명시적 요청(일일 브리핑·재시작 코치) 몫으로 남긴다. 워커가 하루치를 독식해 사용자 버튼이 굶는 일을 막는다.
- 실패 환급: 공급자 호출이 읽을 수 있는 응답을 내지 못하면 `attempts`를 되돌려 사용자에게 청구하지 않고 다음 회차에 재시도한다. 실제 전송된 요청 수는 별도 `calls` 칼럼에 남아 **환급되지 않으며 하루 40회에서 멈춘다.** 환급-재시도 반복이 무한해지지 않도록 하는 유일한 상한이다.
- 수집 cron은 이름·설계와 달리 매분(`* * * * *`)으로 예약돼 있었다. 명세대로 매시간(`0 * * * *`)으로 정정한다.
- 코칭 기능 자체의 하루 3건 기록 한도(`study_coaching_mutate`)는 변경하지 않는다. 번역(DeepL)과 검색(Tavily) 예산도 종전대로 분리 유지한다.
- 유료 전환은 여전히 없다. `provider.max_price {prompt:0,completion:0,request:0}`과 무료 모델 강제는 그대로다.


## 2026-09-14 승인 방향 — 분류·오늘의 브리핑·관심 UX

- 사용자는 자동 분류, 마크다운 가독성, 자유 입력 중심 관심 설정, 오늘 통계 자동 표시+버튼형 AI 인사이트 생성/재사용을 승인했다.
- 기존 분류를 요약 성공에만 의존하지 않도록 분리한다. 유효 AI 분류 보존, 보수적 규칙 fallback 및 기존 글 백필. 불명확한 글을 강제 분류하지 않고 반복 미분류 배지는 숨긴다.
- 콘텐츠 유형(news/practice/deep_dive)과 실제 기술 주제 태그를 구분한다. 고정 관심 체크박스는 활성 UI에서 제거하고 자유 입력을 수집 기준으로 한다. 기존 값은 삭제하지 않는다. 동적 주제/실제 출처는 접힌 보기 필터다.
- 미리보기는 마크다운 기호를 정리하고 펼친 내용은 안전한 제목/문단/목록/코드로 표시한다. 원문과 출처를 보존하며 raw HTML/위험 링크를 실행하지 않는다.
- 오늘 통계는 계정 시간대 및 서버 최초 수집일 기준의 전체 조회 가능 기사(페이지/임시 필터와 독립). AI는 명시적 요청만 실행하고 근거/분석 건수/캐시 시각을 표시한다. 무료 공유 호출 한도·유료 전환 금지 유지.
- 상세 설계: docs/tech-feed/daily-briefing-design.md; 구현과 검증 문서: daily-briefing-implementation.md / daily-briefing-verification.md. 로컬 구현·전체685개 테스트 및390/1440px 검증 완료. 운영 반영 상태는 progress.md를 따른다.
- 이 승인 방향은 아래 이전 고정 관심 분야 UI 및 null category를 항상 미분류로 노출하던 화면 정책을 대체한다. 수집 권한·저장/할 일·출석 정책은 유지한다.


## 2026-09-14 승인 개정 — 원문 썸네일·첨부 영상

- 사용자 "진행하고 작업이 끝났으면 배포해"로 원문 미디어 표시와 완료 후 운영 배포 승인.
- 원문의 Open Graph/Twitter 대표 이미지 1개와 허용 제공자(YouTube/Vimeo) 첨부 영상 식별자를 확인한다. 기존 영상 원문 링크도 안전한 플레이어로 연결하되 새 검색의 영상 도메인 제외는 유지한다.
- 이미지 지연 로딩·전체 비율 유지·no-referrer, 영상은 버튼 클릭 후 외부 플레이어 로드/자동재생 없음/닫기 제공. 미지원 영상·접근 차단·미디어 없음/실패는 원문 읽기와 텍스트 유지.
- 원문 HTML은 제한된 메타데이터 추출에만 일시 사용하고 전체 본문/이미지 바이너리를 DB에 저장하지 않는다. 관련 없는 이미지 검색·AI 이미지·추가 유료 API 없음.
- 매 수동/정기 작업 최대3개(미디어 단계12초, 개별6초), 공용90초 lease 캐시. 성공/없음7일·실패1일 후 재확인, 기존 글도 최신순 처리. 모든 글의 썸네일/영상 재생은 보장하지 않는다.
- 원문 요청은 기존 DNS/TLS 검증·1MiB·리디렉션 검증 transport. robots noindex/noimageindex/미리보기 none 존중. 서비스 전용 RLS/RPC, 수신 중지 재검증, 원문 URL 변경 시 낡은 캐시 숨김.
- 외부 이미지 서버/플레이어가 방문자의 네트워크 정보를 받을 수 있으며 영상은 클릭 전 요청하지 않는다. 출처의 재사용 권한을 대신 승인하지 않는다.


## 2026-09-14 승인 개정 — 일반 기술 블로그 중심의 읽기 피드

- 사용자 진행 승인 및 정정: AWS 아키텍처/기업 블로그/Claude Code 스킬은 예시다. 특정 업체·도구 목록으로 제한하지 않고 사용자가 입력한 관심 기술의 블로그·실무 사례·해설·활용 가이드를 찾는다.
- 관심 주제별 블로그 → 사례 분석 → 활용 가이드 순환. 공유 query_cursor와 요청당 기본검색1회·최대5개 결과는 유지하며 검색 기간은 최근1주에서1년으로 확장한다. 실제 발행일을 보존하고 날짜를 추정하지 않는다.
- 공개 검색 소개와 승인된 RSS/API가 제공한 텍스트만 사용한다. 전체 본문 크롤링·영상 요약·SNS 인증·스킬 자동 설치·유료 전환은 추가하지 않는다.
- 영상 및 명백한 목록 페이지는 새 검색 수집에서 제외한다. query 기반 실제 글은 보존하고 기술 장애 타임라인을 영상 시간표로 오인하지 않는다.
- 명확한 홍보 문장/챕터 목록만 정리한다. 문장 경계가 불명확하면 기술 본문을 보존하며 근거 부족 시 원문 안내를 표시한다. 기존 영상 기록은 삭제하지 않고 링크·저장·할 일 연결을 보존한다.
- 제목과 소개 바로 아래 출처가 서버의 원문 URL로 연결된다. 검색 소개 출처와 원문 발췌 출처, AI 요약은 구분한다.
- 피드 전용 Pretendard Variable(고정v1.3.9 CDN, 시스템 고딕 fallback), 본문PC17px/모바일16px, 보조텍스트13px 이상 및44px 링크 터치영역. 밝은 숲 테마와20개 페이지 흐름 유지.
- 검색 월900/공유AI6회/DeepL월45만자, RSS 사용조건 승인, 사용자별 저장 격리 불변. DB migration 없음. 로컬 구현/운영 배포 상태는 progress.md를 따른다.


## 2026-09-13 — 페이지형 SNS 읽기 화면 승인

- 사용자 "구현해줘"로 짧은 화면안 승인. 기존20개씩 더 보기/누적 표시는20개 페이지 전환으로 대체.
- 기존 커서 기반 이전/다음·방문 페이지 번호·캐시 복귀. 자동 재정렬 금지. 필터/계정/명시적 새 글 확인 후1페이지 조회.
- Threads형 단일 열: 출처 이니셜·이름·시간, 관심 태그, 한국어 제목·짧은 소개, 전체 소개/AI3항목 요약 펼치기, 원문 텍스트 별도 접기, 원문/저장/공부할일 행동.
- PC 중앙 읽기 영역, 모바일 한 열·44px 터치 영역, 밝은 크림/숲색 유지. 관심·수집 설정 패널은 접되 첫 입력과 설정 충돌 시 관심 패널 열기.
- 수집하지 않은 본문·이미지·반응 수치 생성 금지. 기존 번역/무료 제한/출처 권한/공부 기능 불변.
- 저장 해제로 미열람 글 건너뛰기/다음 페이지 접근 불가가 발생하지 않아야 함. 조회 실패 시 현재 내용 유지, 계정 전환 시 이전 요청/내용 차단.

## 2026-09-13 — DeepL 한국어 번역 구현 승인

- 최신 사용자 "구현해줘"로 DeepL API Free 제목·소개 번역을 확정한다. 아래 공급자 미확정/확인 대기는 이전 이력이다.
- 원문 제목·소개만 번역하며 본문 크롤링·원문 사이트 전체 번역은 하지 않는다. 한국어를 기본 표시하고 원문 텍스트는 접어서 제공한다. 원문 URL은 변경하지 않는다.
- 기존 글도 대상이며 같은 기사 번역은 구독자 간 재사용한다. 원문이 바뀌면 기존 번역을 숨기고 다시 처리한다.
- 코칭/요약의 사용자당 실제6회/일은 그대로 유지한다. 번역은 별도 앱 공용 UTC월450000자 원자적 예산과 DeepL Free 실제 잔여량을 함께 검사한다. 실패한 POST도 예약 문자를 환급하지 않는다.
- 서버 DEEPL_API_KEY만 사용하고 api-free.deepl.com 고정, 유료키/유료 endpoint/fallback 금지. 키 미등록·중지·한도·오류는 원문과 정확한 상태를 제공한다.
- 수동/정기 수집마다 최대3개 순차 번역, 전체 즉시 번역은 보장하지 않는다. 출처 승인/구독 권한 및 요청 시 수신중지 재검증을 유지한다. 상세 docs/tech-feed/korean-translation.md.

## 2026-09-13 — 번역 예산 분리 승인

- 사용자 승인으로 제목·소개 번역에는 코칭의 사용자당 하루6회 제한을 그대로 적용하지 않는다. 번역 공급자의 실제 무료 한도 내 별도 예산/중복 캐시로 관리한다. 코칭 기존 동작은 유지한다.
- 유료 자동 전환 금지, 한도/장애 시 원문+번역 대기. 공급자(번역API vs AI) 선택은 비교 후 확인 중이며 아직 제품 코드/운영에 적용하지 않았다.

## 2026-09-13 — 승인된 매 클릭 즉시 수집 개정

- 사용자 진행 승인. 아래 수동5분 조건을 대체: 완료 후 다음 명시적 클릭은 즉시 수집. 실행 중 중복 요청만 lease로 합친다. 정기1시간 TTL, 실패 backoff, 무료 검증/월900은 유지한다.
- 복합 관심은 쉼표·세미콜론·및·그리고·and 기준으로 나누고 중복 제거 후 한 번에 하나씩 순환 검색한다. 요청당 기본검색1회. 실제 사용량 예약 때만 공유 query_cursor 증가(실패 포함). 저장 입력과 구독 identity는 바꾸지 않는다.
- 단일 주제는 그대로 검색. 보안 URL 필터/무료 AI 제한 불변.0건/미실행/오류를 구분하고 새 글 도착을 보장하지 않는다.

## 2026-09-13 승인 개정 — 카드 미등록 무료 계정 수집 활성화

- 사용자 카드 미등록 확인과 수집 활성화 승인으로, null 한도를 무조건 거부하던 조건을 개정한다. Free/Researcher·무료 잔여량·paygo 사용0·앱900회 원자적 제한을 유지한다.
- key.limit의 명시적 null은 무료 계정 잔여량 기준으로 제한한다. 숫자 한도는 추가 상한이며0이면 소진이다. paygo_limit은 null 또는0만 허용; null을 결제 비활성화 증거라고 주장하지 않는다.
- 필드 누락/잘못된 타입/유료 요금제/양수 paygo 한도·사용량/한도 소진은 차단한다. 전용 카드 미등록 계정 사용, 기본검색1크레딧, 제공자 작업 잠금, 앱 전체 월900회 유지. 유료 설정을 변경하지 않는다.
- 서버2개 재배포 후 실제 검색·기사 저장·별도 Cron을 검증한다. 아래 예전 명시적 한도 필수 조건은 이 개정으로 대체한다.

## 2026-09-13 승인 개정 — 새 글 확인 즉시 수집

- 사용자가 짧은 설계에 `진행해줘`로 승인했다. 기존 시간당1회 캐시는 자동 수집에 유지하고, 명시적 버튼 요청에만 수동 예외를 둔다.
- 새 글 확인은 목록 재조회가 아니라 인증된 즉시 수집 요청이다. 요청 중 상태/버튼 비활성화, 완료 후 목록 반영, 공유 작업 상태 확인을 제공한다.
- 계정 및 같은 주제·출처5분 제한, 기존 작업 lease/실패 백오프/무료 계정 검증/앱 전체 월900회 상한을 유지한다. 관심 내용 변경으로 계정 제한을 우회하지 않는다.
- 현재 관심 주제1개와 승인된 구독 RSS/API 최대4개를 확인한다. 매번 새 글이 있거나 전체 출처를 즉시 확인한다고 보장하지 않는다. 수동 요청은 AI 추가 호출 없이 실제 소개/원문부터 제공한다.
- 미연결·중지·한도·부분 실패·실행 중·최근 요청 대기를 구분한다. 계정 전환/설정 revision 충돌의 오래된 요청을 반영하지 않는다.
- 서버 비밀값/수집 활성화/출처 승인은 자동 변경하지 않는다. 운영 가동과 코드 배포를 별도 검증한다.
- 세부 API 및 검증: docs/tech-feed/web-search-spec.md, manual-refresh-verification.md. 아래 한 시간 공유 설명은 정기 수집 기준이다.

## 공개 웹 검색과 셀프서비스 — 승인된 추가 요구사항

- 웹에서 관심 내용 3~300자를 입력하여 수신 시작·수정·중지를 한다. 일반 사용자에게 SNS 연동이나 검색 API 키를 요구하지 않는다.
- 검색 제공자가 색인한 공개 웹 결과를 RSS/Atom/Hacker News와 함께 제공한다. 비공개 글·유료벽 우회·완전한 웹 크롤링은 지원하지 않는다.
- 정규화 후 동일한 전체 검색문은 사용자 수와 관계없이 한 시간 동안 캐시를 공유한다. 의미만 유사한 문장까지 자동으로 합친다고 보장하지 않는다.
- 입력한 관심 내용은 검색 제공자에 전달됨을 알린다. 사용자 ID·이메일은 전송하지 않으며, 민감한 정보 입력을 금지하고 URL·이메일·인증정보 형태를 검증한다.
- Tavily 기본 검색만 사용한다. 실제 요청 전 무료 계정/키의 남은 한도와 종량제 비활성화를 확인할 수 없으면 검색하지 않는다.
- 앱 전체 공용 월간 검색 시도 한도는 기본 900회, 상한 900회다. DB 잠금과 원자적 예약으로 동시 호출을 제어하며 실패한 호출도 계산한다. 검색량이 많으면 한 달 내내 매시간 수집을 보장할 수 없다.
- 검색 한도 소진·검색 장애는 웹 검색만 멈춘다. 승인된 활성 RSS/API는 독립적으로 유지하고, 전체 수집 중지나 미승인 소스를 정상 가동으로 표시하지 않는다.
- 유료 과금·고급 검색·유료 AI·다른 제공자로 자동 전환하지 않는다. 충분한 실제 검색 소개만 AI에 전달하고 부족하면 소개와 원문 링크만 제공한다.
- 검색 소개/AI 요약/원문 발췌의 출처를 구분한다. 검색에 나온 사이트를 자동으로 RSS 승인하지 않는다.
- 관심 내용·수신 상태·구독·저장·할 일 연결은 소유자별로 동기화한다. 수정 시 버전 충돌을 확인하고 다른 계정의 늦은 응답을 반영하지 않는다.
- self-service 모드에서는 웹 수신 동의가 기준이며 계정별 환경 변수 등록은 필요하지 않다. 전역 수집 중지와 사용자 설정 저장은 분리한다.
- 구현·운영 세부 기준: [명세](../docs/tech-feed/web-search-spec.md), [운영 가이드](../docs/tech-feed/search-provider.md). 코드 배포와 실제 키 연결/예약 수집 검증은 별도로 기록한다.

아래 2026-09-12 이전 설계 기록의 웹 검색 제외 및 소유자 파일럿 전용 조건은 이 개정으로 대체된다. 과거 진행 기록은 이력으로 유지한다.

## 2026-09-12 승인 개정 — 웹 검색 포함 맞춤 피드

사용자가 공개 웹 검색 포함 구현과 공유 검색 캐시, 무료 한도 소진 시 RSS/API 유지, 유료 자동 전환 금지, 근거 기반 요약 원칙을 명시적으로 승인했다. 이제 아래 옛 Non-goals의 General web search 제외와 설계 경계 미확정 기록은 적용하지 않는다.
현재 구현 기준: docs/tech-feed/web-search-spec.md. 실행 계획: docs/tech-feed/web-search-implementation.md. 일반 사용자는 웹에서 관심 내용/수신을 설정하며 외부 계정/API 키를 넣지 않는다. 운영 검색 키는 앱 서버에만 저장한다. 아직 구현 중이며 가동 완료가 아니다.

## 2026-09-12 후속 설계 검토 — 관심 내용 입력형 피드

사용자가 웹에서 원하는 정보를 입력하고 소식 수신을 직접 시작/중지하는 방향을 요청했다. 외부 계정 연동/API 키 입력은 요구하지 않는다. 세부 검토안은 docs/tech-feed/topic-feed-design.md에 있다.
기존 RSS/API 기반 맞춤 선별과 일반 웹 검색 추가는 구분한다. 첫 버전 범위 확인 전 아래 Non-goals와 운영 정책을 자동으로 변경하지 않는다. 아직 구현/운영에 적용되지 않은 설계안이다.

# PRD: 시간별 기술 피드

User approved 2026-09-12. Replaces active career-driven StudyRoom 2.0 with a simple technology learning feed. Implementation only; no commits, push, remote migrations or deployments without a separate request.

## Problem / Goals
Discover current technology without complex career setup: discover → Korean summary → original source → explicit study todo. Desktop and mobile web; keep Today as default.

## User scenarios and requirements
- Hourly server collection of subscribed public RSS/Atom and Hacker News API; no three-items-per-day cap.
- Eight recommended sources: GeekNews, Hacker News, Hugging Face, Simon Willison, AWS What's New, GitHub Changelog, Toss, Woowahan.
- Latest/saved views, interest/source filters, collapsible subscriptions; 20-item cursor pages, no automatic reorder while reading.
- Interests: ai, frontend, backend, cloud, tools. Categories: news, practice, deep_dive; null means unclassified.
- Show source, published time, excerpt/summary provenance, last successful collection and partial failure. No external notifications.
- Preview public HTTPS RSS/Atom before subscribing; max 10 custom sources per user; no authenticated/private/token-bearing feed URLs.
- Persist subscriptions, interests, saves and todo links server-side with owner isolation across devices.
- Open existing todo editor with title/date/time; explicit save creates todo and original-article link atomically/idempotently.

## Collection / AI / safety
- Shared collection per normalized source; seven-day/50-item initial import; later incremental collection, no re-dating old posts.
- Source GUID and normalized original URL deduplication, preserving multiple source attributions.
- Conditional GET, bounded responses/time/concurrency, leased jobs, failure backoff, 90-day unreferenced article retention.
- Public excerpts only; no arbitrary original-page crawling or paywall bypass. Insufficient text stays unsummarized.
- Free-only existing OpenRouter client, six actual calls/user/day shared with restart coaching including failed calls; up to three articles per call, cached results. No paid fallback.
- Summary: what technology / key change / application. Validate output shape; URLs always server-owned. Article text is untrusted data, never instructions.
- Block SSRF (including DNS/redirects), XXE, oversized bodies and unsafe HTML. RLS isolates subscriptions/saves/custom feeds. Server-only writes for collection and AI.
- Source permission review is distinct from RSS availability. Unknown permission remains disabled; no claim all eight are launch-ready.

## Career archive / compatibility
Archive dedicated career UI/server/tests with restore instructions; keep DB/migration history and shared free AI/quota. Tombstone old entrypoints to prevent stale clients scheduling work. Disable only career cron at separately approved rollout. Extract timezone saving from career API. Preserve timer, attendance, todos, reports, forest, restart coaching.

## Release and validation
Owner-only pilot feature flag; additive migration → Edge handlers → web → hourly Cron activation, only on separate authorization. Kill switch stops feed only. Verify parser/adapters, RLS/SSRF/idempotency/leases, AI fallbacks and 390px browser interactions; existing test/build/Edge/mobile/docs checks. Production cron and actual AI quality are separate from synthetic/local verification.

## Non-goals
General web search, SNS OAuth, private content, video summarization, Expo feed UI, external notifications, paid inference.
