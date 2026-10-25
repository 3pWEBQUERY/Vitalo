-- Apple refresh token, needed to revoke Sign in with Apple when an account is deleted.
alter table users add column if not exists apple_refresh_token text;
