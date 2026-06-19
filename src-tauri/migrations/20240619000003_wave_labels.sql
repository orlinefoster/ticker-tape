-- Wave labels for Elliott Wave analysis.
--
-- Each row represents ONE identified wave in a symbol+timeframe.
-- The UNIQUE constraint prevents duplicate labels so recounting
-- only adds/updates rows, preserving any manual edits the user made.
--
-- Wave degrees (from largest to smallest):
--   Grand Supercycle → Supercycle → Cycle → Primary → Intermediate →
--   Minor → Minute → Minuette → Subminuette
--
-- Standard labels:
--   Impulse: 1, 2, 3, 4, 5
--   Corrective: A, B, C (or W, X, Y for complex corrections)

CREATE TABLE IF NOT EXISTS wave_labels (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT NOT NULL,
    timeframe   TEXT NOT NULL DEFAULT '1d',
    wave_degree TEXT NOT NULL,
    wave_label  TEXT NOT NULL,
    start_date  TEXT NOT NULL,
    end_date    TEXT,
    price_start REAL,
    price_end   REAL,
    confidence  REAL NOT NULL DEFAULT 0.0
                CHECK (confidence >= 0.0 AND confidence <= 1.0),
    is_automatic INTEGER NOT NULL DEFAULT 1,
    notes       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(symbol, timeframe, wave_degree, wave_label, start_date)
);

CREATE INDEX IF NOT EXISTS idx_wave_labels_symbol
    ON wave_labels(symbol, timeframe, start_date);
