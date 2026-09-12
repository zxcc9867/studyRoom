## 2026-09-12 제품 방향 개정 — 승인된 기술 피드

- 복잡한 커리어 입력/로드맵/자동 태스크 제안 대신 공개 기술 소식에서 스스로 공부할 일을 선택하는 흐름을 활성 제품으로 삼는다.
- 기술 피드는 보조 탭이며 오늘의 공부 시작/타이머를 대체하지 않는다. SNS 로그인·일반 웹 검색·영상 요약·유료 AI는 이번 범위가 아니다.
- 무료 AI 실패 시 출처 소개를 제공하며 미검증 요약/성능을 만들어내지 않는다. 출처 허가·개인 데이터 격리·기존 출석 안정성을 우선한다.
- 기존 커리어 관련 설명은 보관된 설계 기록이며 새 요구사항은 `prd-tech-feed.md`가 우선한다.

# Design Document

## Why

The study-room app helps users build a daily study habit by forcing attendance within a fixed window after a scheduled reminder.

## What

The MVP provides a Vite web dashboard, Expo mobile app, Supabase backend, attendance tracking, study sessions, todos, and scheduled notifications.

## Problem

Static hosting alone can show the app, but it cannot reliably send reminders at a configured time. Scheduled backend execution is required.

## Target Users

Personal MVP users who want a lightweight study room dashboard with attendance pressure, todo visibility, and push/email reminders.

## Core Features

- Email OTP and optional OAuth login through Supabase Auth
- Daily reminder time
- Attendance recognition when a study timer starts within the allowed window
- Study sessions and daily/monthly time visualization
- 휴식이 무기한 이탈로 바뀌지 않도록 10·20·40분 복귀 약속과 비징벌적 복귀 신호 제공
- 활성 세션의 첫 10분 진행도와 비징벌적 이어가기·마무리 선택을 제공하는 습관 체크포인트
- 세션 종료 회고, 과거 기간을 선택하는 주간·월간 학습 리포트, 실제 공부 시작 패턴을 반영하는 적응형 알림
- 주간 회고의 다음 행동을 기존 todo 날짜·시간 계획으로 연결하는 주간 리셋 브리지
- Calendar todos, weekday recurring todo creation, and completion rate
- Today task checklist plus a pinned circular life-planner view for timed todos
- User-customizable Today dashboard section order
- Study Forest reward page where seven-day attendance streaks grow trees in a personal low-poly 3D space
- My Page hash page with account summary and completed todo history
- Web/Expo/email notification targets
- Scheduled reminder dispatch through Supabase Edge Function

## Non-goals

- Replacing Supabase Auth/DB with AWS services
- Running an always-on Node.js server
- Adding paid AWS managed databases for the MVP

## Product Principles

- Keep personal MVP operating cost as close to zero as practical.
- Prefer static hosting plus serverless scheduled execution.
- Keep user data protected by Supabase RLS.
- Do not store service-role keys or secrets in frontend code.
