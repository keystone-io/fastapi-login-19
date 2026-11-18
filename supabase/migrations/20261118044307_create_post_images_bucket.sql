-- 게시글 대표 이미지 저장소 (Supabase Storage 버킷)
--   파일 위치: post-images/<회원 id>/<임의 이름>.<확장자>
--   보기   : 공개 버킷 → https://<ref>.supabase.co/storage/v1/object/public/post-images/... 로 누구나 볼 수 있음
--   올리기 : FastAPI 가 "로그인한 회원의 토큰"으로 올린다 → 아래 규칙(정책)으로 자기 폴더에만 허용

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  5242880,  -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']  -- svg 는 스크립트를 담을 수 있어 제외
);

-- 로그인한 회원(authenticated)만, 자기 id 폴더에만 올릴 수 있다
-- (publishable 키만 가진 비회원(anon)은 못 올림)
create policy "post-images 업로드: 본인 폴더만"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- 자기 파일만 지울 수 있다 (나중에 이미지 교체·글 삭제 때 정리용)
create policy "post-images 삭제: 본인 파일만"
on storage.objects for delete to authenticated
using (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
