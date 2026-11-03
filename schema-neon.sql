-- =====================================================================
-- Study App Schema (Neon Postgres + Node.js)
-- Auth is handled in your Node API (bcrypt + JWT/session), and access
-- checks (e.g. "is this note mine?") are done in API code, not RLS.
-- Weather and the clock timestamp are NOT stored (API / browser).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. USERS + SETTINGS
-- ---------------------------------------------------------------------
create table users (
  user_id       uuid primary key default gen_random_uuid(),
  username      varchar(50)  unique not null,
  first_name    varchar(100) not null,
  last_name     varchar(100) not null,
  email         varchar(255) unique not null,
  password_hash varchar(255) not null,
  avatar_url    text,
  role          varchar(20) not null default 'student',
  created_at    timestamp not null default now()
);

create table user_settings (
  user_id           uuid primary key references users(user_id) on delete cascade,
  timezone          varchar(50) not null default 'Asia/Manila',
  weather_city      varchar(100),
  weather_lat       numeric(9,6),
  weather_lng       numeric(9,6),
  temp_unit         char(1) not null default 'C' check (temp_unit in ('C','F')),
  show_quote        boolean not null default true,
  show_verse        boolean not null default true,
  show_weather      boolean not null default true,
  default_focus_min int not null default 25,
  default_break_min int not null default 5,
  theme             varchar(20) not null default 'light',
  updated_at        timestamp not null default now()
);

-- ---------------------------------------------------------------------
-- 2. SUBJECTS, NOTES, TAGS, SHARING
-- ---------------------------------------------------------------------
create table subjects (
  subject_id serial primary key,
  user_id    uuid not null references users(user_id) on delete cascade,
  name       varchar(100) not null,
  color      varchar(9) default '#6366f1',
  created_at timestamp not null default now(),
  unique (user_id, name)
);

create table notes (
  note_id     uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(user_id) on delete cascade,
  subject_id  int references subjects(subject_id) on delete set null,
  title       varchar(255) not null default 'Untitled',
  content     text not null default '',
  is_pinned   boolean not null default false,
  is_archived boolean not null default false,
  created_at  timestamp not null default now(),
  updated_at  timestamp not null default now()
);
create index notes_user_idx    on notes(user_id, updated_at desc);
create index notes_subject_idx on notes(subject_id);
create index notes_search_idx  on notes
  using gin (to_tsvector('english', title || ' ' || content));

create table tags (
  tag_id  serial primary key,
  user_id uuid not null references users(user_id) on delete cascade,
  name    varchar(50) not null,
  unique (user_id, name)
);

create table note_tags (
  note_id uuid references notes(note_id) on delete cascade,
  tag_id  int  references tags(tag_id)   on delete cascade,
  primary key (note_id, tag_id)
);

create table note_shares (
  note_id     uuid references notes(note_id) on delete cascade,
  shared_with uuid references users(user_id) on delete cascade,
  can_edit    boolean not null default false,
  created_at  timestamp not null default now(),
  primary key (note_id, shared_with)
);

-- ---------------------------------------------------------------------
-- 3. FRIENDS
-- ---------------------------------------------------------------------
create table friendships (
  friendship_id serial primary key,
  requester_id  uuid not null references users(user_id) on delete cascade,
  addressee_id  uuid not null references users(user_id) on delete cascade,
  status        varchar(10) not null default 'pending'
                check (status in ('pending','accepted','blocked')),
  created_at    timestamp not null default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

-- ---------------------------------------------------------------------
-- 4. STUDY ROOMS (video call state; media goes through WebRTC provider)
-- ---------------------------------------------------------------------
create table study_rooms (
  room_id       uuid primary key default gen_random_uuid(),
  host_id       uuid not null references users(user_id) on delete cascade,
  name          varchar(100) not null,
  topic         varchar(255),
  video_room_id varchar(100) unique,   -- room name at Jitsi/LiveKit/Daily
  max_members   int not null default 8,
  is_active     boolean not null default true,
  created_at    timestamp not null default now(),
  ended_at      timestamp
);

create table room_members (
  room_id   uuid references study_rooms(room_id) on delete cascade,
  user_id   uuid references users(user_id)       on delete cascade,
  role      varchar(10) not null default 'member' check (role in ('host','member')),
  cam_on    boolean not null default true,
  mic_on    boolean not null default true,
  joined_at timestamp not null default now(),
  left_at   timestamp,
  primary key (room_id, user_id)
);

create table room_invites (
  invite_id    serial primary key,
  room_id      uuid not null references study_rooms(room_id) on delete cascade,
  invited_by   uuid not null references users(user_id) on delete cascade,
  invited_user uuid references users(user_id) on delete cascade, -- null = open link
  code         varchar(24) unique not null,   -- generate in Node (e.g. nanoid)
  status       varchar(10) not null default 'pending'
               check (status in ('pending','accepted','declined','expired')),
  expires_at   timestamp not null default (now() + interval '24 hours'),
  created_at   timestamp not null default now()
);

create table room_messages (
  message_id serial primary key,
  room_id    uuid not null references study_rooms(room_id) on delete cascade,
  user_id    uuid not null references users(user_id)       on delete cascade,
  body       text not null,
  created_at timestamp not null default now()
);
create index room_messages_idx on room_messages(room_id, created_at);

-- ---------------------------------------------------------------------
-- 5. FOCUS MODE
-- ---------------------------------------------------------------------
create table focus_sessions (
  session_id  uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(user_id) on delete cascade,
  note_id     uuid references notes(note_id) on delete set null,
  subject_id  int  references subjects(subject_id) on delete set null,
  room_id     uuid references study_rooms(room_id) on delete set null,
  planned_min int not null check (planned_min > 0),
  actual_min  int,
  break_min   int not null default 0,
  status      varchar(12) not null default 'running'
              check (status in ('running','completed','cancelled')),
  started_at  timestamp not null default now(),
  ended_at    timestamp
);
create index focus_user_idx on focus_sessions(user_id, started_at desc);

create view daily_focus_stats as
select user_id,
       date_trunc('day', started_at) as day,
       sum(coalesce(actual_min, 0))  as focus_minutes,
       count(*)                      as sessions
from focus_sessions
where status = 'completed'
group by user_id, date_trunc('day', started_at);

-- ---------------------------------------------------------------------
-- 6. QUOTES & BIBLE VERSES
-- Random pick in Node:  select * from quotes where is_active
--                       order by random() limit 1;
-- ---------------------------------------------------------------------
create table quotes (
  quote_id  serial primary key,
  text      text not null,
  author    varchar(100),
  is_active boolean not null default true
);

create table bible_verses (
  verse_id    serial primary key,
  book        varchar(50) not null,
  chapter     int not null,
  verse_start int not null,
  verse_end   int,
  text        text not null,
  version     varchar(10) not null default 'KJV',
  is_active   boolean not null default true
);

create table favorite_quotes (
  user_id  uuid references users(user_id)    on delete cascade,
  quote_id int  references quotes(quote_id) on delete cascade,
  primary key (user_id, quote_id)
);

create table favorite_verses (
  user_id  uuid references users(user_id)          on delete cascade,
  verse_id int  references bible_verses(verse_id)  on delete cascade,
  primary key (user_id, verse_id)
);

-- ---------------------------------------------------------------------
-- 7. SEED DATA
-- ---------------------------------------------------------------------
insert into quotes (text, author) values
  ('The secret of getting ahead is getting started.', 'Mark Twain'),
  ('It always seems impossible until it is done.', 'Nelson Mandela');

insert into bible_verses (book, chapter, verse_start, text, version) values
  ('Philippians', 4, 13, 'I can do all things through Christ which strengtheneth me.', 'KJV'),
  ('Proverbs', 3, 5, 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.', 'KJV');
