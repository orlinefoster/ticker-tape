-- User Authentication and Encrypted Vault Schema

CREATE TABLE IF NOT EXISTS user_auth (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt_hex TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vault_entries (
    key TEXT PRIMARY KEY NOT NULL,
    nonce_hex TEXT NOT NULL,
    ciphertext_hex TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
