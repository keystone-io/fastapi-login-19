-- 게시판(토론) 테이블
--   posts      : 게시글 (작성자 = profiles.id, Supabase 회원 UUID 와 같은 값)
--   post_likes : 좋아요 (한 사람이 한 글에 한 번만 → (post_id, user_id) 가 기본키)
-- 반영: 프로젝트 폴더에서  supabase db push --db-url "<DATABASE_URL>"

create table public.posts (
  id          bigint generated always as identity primary key,
  author_id   varchar(50)  not null references public.profiles (id) on delete cascade,
  category    varchar(20)  not null default '토론',
  title       varchar(200) not null check (char_length(btrim(title)) > 0),
  content     text         not null check (char_length(btrim(content)) > 0),
  tags        jsonb        not null default '[]'::jsonb,  -- 예: ["인공지능", "AI"]
  image_url   text,                                      -- 카드 오른쪽 썸네일 (선택)
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create index posts_created_at_idx on public.posts (created_at desc);
create index posts_category_idx   on public.posts (category, created_at desc);
create index posts_author_id_idx  on public.posts (author_id);

create table public.post_likes (
  post_id     bigint      not null references public.posts (id) on delete cascade,
  user_id     varchar(50) not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_likes_user_id_idx on public.post_likes (user_id);

-- RLS 켜기 (정책은 만들지 않음)
--   글 읽기·쓰기는 FastAPI 가 DB 에 직접 접속해서 처리한다 (RLS 영향 없음)
--   RLS 를 켜 두면 브라우저에 노출되는 publishable 키로 Supabase Data API 를 직접 호출해도
--   이 테이블은 읽거나 바꿀 수 없다 → 반드시 FastAPI(작성자 확인)를 거치게 된다
alter table public.posts      enable row level security;
alter table public.post_likes enable row level security;
