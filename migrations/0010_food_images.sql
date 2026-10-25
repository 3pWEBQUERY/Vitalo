-- Product photos uploaded in the admin area, stored in the bucket.
alter table media drop constraint if exists media_purpose_check;
alter table media add constraint media_purpose_check check (purpose in ('brand_icon', 'brand_logo', 'post', 'progress_photo', 'label', 'food_image'));
alter table foods add column if not exists image_media_id uuid references media(id) on delete set null;
