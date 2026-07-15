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
- 세션 종료 회고, 주간 비교 리뷰, 실제 공부 시작 패턴을 반영하는 적응형 알림
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
