-- SmartAutomation Supabase Schema

-- Table for Temperature History
create table if not exists sensor_history (
  id uuid primary key default gen_random_uuid(),
  sensor_type text not null, -- 'temp', 'humidity', etc.
  value float not null,
  created_at timestamp with time zone default now()
);

-- Table for Relay Status
create table if not exists relay_status (
  id int primary key, -- 1 to 8
  label text not null, -- User defined name (e.g., 'Garden Lights')
  is_on boolean default false,
  last_updated timestamp with time zone default now()
);

-- Table for Scheduling (Timed/Specific Date Actions)
create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  relay_id int references relay_status(id),
  action text check (action in ('on', 'off')),
  scheduled_for timestamp with time zone not null,
  is_executed boolean default false,
  repeat_mode text default 'none' -- 'none', 'daily', 'weekly'
);

-- Realtime Configuration
alter publication supabase_realtime add table sensor_history;
alter publication supabase_realtime add table relay_status;
alter publication supabase_realtime add table schedules;
