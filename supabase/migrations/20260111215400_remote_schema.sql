create extension if not exists "http" with schema "extensions";

create extension if not exists "hypopg" with schema "extensions";

create extension if not exists "index_advisor" with schema "extensions";

drop function if exists "public"."fetch_instagram_posts_and_store"(p_scope text);

drop type "public"."http_header";

drop type "public"."http_request";

drop type "public"."http_response";

drop function if exists "public"."instagram_api_request"(p_route text, p_params jsonb, p_account_id bigint, p_user_id uuid);

drop function if exists "public"."refresh_instagram_tokens"(p_scope text);

alter table "public"."articles" alter column "user_id" drop not null;

alter table "public"."user_roles" alter column "created_at" set default timezone('utc'::text, now());

alter table "public"."user_roles" alter column "updated_at" set default timezone('utc'::text, now());

alter table "public"."user_roles" alter column "updated_at" set not null;

drop extension if exists "http";


