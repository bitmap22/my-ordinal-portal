-- Hall Counter: one row per day and kind of count. © 2026 bitmap22. All rights reserved.
CREATE TABLE IF NOT EXISTS counts (day TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, key));
