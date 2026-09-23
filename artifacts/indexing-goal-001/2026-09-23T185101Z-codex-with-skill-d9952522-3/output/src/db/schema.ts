export const schemaSql = `
create table if not exists indexer_state (
  id text primary key,
  last_indexed_block bigint not null,
  updated_at timestamptz not null default now()
);

create table if not exists check_ins (
  chain_id integer not null,
  contract_address text not null,
  block_number bigint not null,
  block_hash text not null,
  transaction_hash text not null,
  log_index integer not null,
  member text not null,
  day_number bigint not null,
  checked_at timestamptz not null,
  note text not null,
  current_streak_at_check_in integer not null,
  total_check_ins_at_check_in integer not null,
  created_at timestamptz not null default now(),
  primary key (chain_id, contract_address, transaction_hash, log_index)
);

create index if not exists check_ins_feed_idx
  on check_ins (checked_at desc, block_number desc, log_index desc);

create index if not exists check_ins_member_idx
  on check_ins (member, day_number desc);

create table if not exists members (
  member text primary key,
  last_check_in_day bigint not null,
  current_streak integer not null,
  total_check_ins integer not null,
  last_checked_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists members_total_idx
  on members (total_check_ins desc, member asc);

create table if not exists monthly_counts (
  month_start date not null,
  member text not null,
  check_in_count integer not null,
  latest_check_in_at timestamptz not null,
  primary key (month_start, member)
);

create index if not exists monthly_counts_leaderboard_idx
  on monthly_counts (month_start, check_in_count desc, latest_check_in_at asc, member asc);
`;
