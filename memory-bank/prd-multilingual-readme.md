# PRD: Multilingual README

## 1. Problem

현재 프로젝트 설명이 한국어 README에만 집중되어 있어 글로벌 채용 담당자와 일본어 사용자가 프로젝트의 목적, 구조, 실행 방법을 바로 이해하기 어렵다.

## 2. Target Users

- 영어권 채용 담당자와 엔지니어
- 일본어권 채용 담당자와 엔지니어
- 한국어 사용자와 프로젝트 운영자

## 3. Goals

- `README.md`를 영어 기본 문서로 제공한다.
- `README.ko.md`와 `README.ja.md`를 같은 저장소에서 직접 탐색할 수 있게 한다.
- 세 언어에서 제품 목적, 핵심 기능, 아키텍처, 실행, 검증, 보안 원칙을 동일하게 전달한다.

## 4. Non-goals

- 애플리케이션 동작, DB, Supabase, 배포 설정 변경
- 기존 상세 PRD와 운영 이력을 README에 중복 복제

## 5. User Stories

- As a global reviewer, I want an English README by default, so that I can evaluate the project without translation.
- As a Japanese reviewer, I want a Japanese README link at the top, so that I can understand the project accurately.
- As a Korean maintainer, I want the existing Korean documentation preserved, so that operational detail is not lost.

## 6. Functional Requirements

- [x] 영어 `README.md`
- [x] 한국어 `README.ko.md`
- [x] 일본어 `README.ja.md`
- [x] 각 문서 상단의 `English | 한국어 | 日本語` 링크
- [x] 실제 저장소 구조와 일치하는 실행·검증 명령

## 7. Non-functional Requirements

- 민감정보나 실제 사용자 식별자를 포함하지 않는다.
- 번역본 사이에 기능 상태와 보안 설명의 모순이 없어야 한다.
- 링크는 저장소 내부 상대 경로를 사용한다.

## 8. Success Metrics

- 세 README 파일이 GitHub에서 서로 이동 가능하다.
- 언어 링크와 내부 문서 링크가 존재하는 파일을 가리킨다.
- 문서 변경 외 애플리케이션 파일은 수정하지 않는다.
