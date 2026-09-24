create table if not exists indexer_state (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists check_ins (
  id text primary key,
  member text not null,
  day_utc integer not null,
  checked_in_at timestamptz not null,
  timestamp_unix bigint not null,
  note text not null,
  tx_hash text not null,
  block_number bigint not null,
  log_index integer not null,
  month_key text not null,
  created_at timestamptz not null default now(),
  unique (member, day_utc),
  unique (tx_hash, log_index)
);

create index if not exists check_ins_feed_idx on check_ins (block_number desc, log_index desc);
create index if not exists check_ins_member_idx on check_ins (member, day_utc desc);
create index if not exists check_ins_month_idx on check_ins (month_key, member);

create table if not exists member_stats (
  member text primary key,
  total_check_ins integer not null default 0,
  current_streak integer not null default 0,
  last_check_in_day integer,
  last_check_in_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists monthly_counts (
  month_key text not null,
  member text not null,
  check_ins integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (month_key, member)
);

create index if not exists monthly_counts_rank_idx on monthly_counts (month_key, check_ins desc, member);

