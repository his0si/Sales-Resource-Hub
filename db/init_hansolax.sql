-- ============================================================
-- hansolax DB + users 테이블 + 예시 데이터 1건
-- 실행 방법:
--   1) 아래 __SET_YOUR_PASSWORD__ 를 DBeaver 접속에 쓸 실제 비밀번호로 바꾼다
--   2) sudo -u postgres psql -f /home/hansolax/server/db/init_hansolax.sql
-- ============================================================

-- 1. 앱 전용 DB 유저 + DB 생성 (DBeaver는 이 유저로 접속)
CREATE USER hansolax WITH PASSWORD '__SET_YOUR_PASSWORD__';
CREATE DATABASE hansolax OWNER hansolax;

-- 2. hansolax DB로 전환
\c hansolax

-- 3. bcrypt 해싱을 위한 확장 (슈퍼유저 권한 필요 → postgres로 실행)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 4. 이후 객체는 hansolax 유저 소유로 생성
SET ROLE hansolax;

-- 5. users 테이블
CREATE TABLE users (
    id          SERIAL       PRIMARY KEY,                 -- 고유 ID (자동 증가)
    email       VARCHAR(255) UNIQUE NOT NULL,             -- 이메일 (회사 내부 이메일만 허용)
    password    VARCHAR(255) NOT NULL,                    -- 비밀번호 (bcrypt 해싱)
    is_verified BOOLEAN      DEFAULT FALSE,               -- 이메일 인증 여부
    created_at  TIMESTAMP    DEFAULT NOW()                -- 계정 생성일
);

-- 6. 예시 데이터 1건 (평문 'password123' 을 bcrypt 로 저장)
INSERT INTO users (email, password, is_verified)
VALUES (
    'admin@hansolax.com',
    crypt('password123', gen_salt('bf')),   -- bcrypt 해시 ($2a$...)
    TRUE
);

RESET ROLE;

-- 7. 확인
\c hansolax
SELECT id, email, password, is_verified, created_at FROM users;
