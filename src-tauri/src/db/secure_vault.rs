//! Secure Vault Module — User authentication and AES-256-GCM encrypted persistence.
//!
//! Provides hardware-grade encryption for sensitive portfolio data, user settings,
//! and strategy configurations. All sensitive payloads in the database are encrypted
//! at rest using AES-256-GCM with keys derived via Argon2 from the user's PIN/Passphrase.

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use anyhow::{anyhow, Context, Result};
use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite};
use std::sync::LazyLock;
use tokio::sync::RwLock;

/// Global in-memory active encryption key.
/// Zeroized and cleared upon vault lock.
static ACTIVE_KEY: LazyLock<RwLock<Option<[u8; 32]>>> = LazyLock::new(|| RwLock::new(None));

/// Typed vault error for authentication/lock enforcement.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VaultError {
    Locked,
}

impl std::fmt::Display for VaultError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VaultError::Locked => write!(f, "Vault is locked"),
        }
    }
}

impl std::error::Error for VaultError {}

/// Status of the user vault.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VaultStatus {
    pub is_initialized: bool,
    pub is_unlocked: bool,
    pub username: Option<String>,
}

/// Internal user auth record from SQLite.
#[derive(Debug, sqlx::FromRow)]
struct UserAuthRow {
    username: String,
    password_hash: String,
    salt_hex: String,
}

/// Internal encrypted vault entry row from SQLite.
#[derive(Debug, sqlx::FromRow)]
struct VaultEntryRow {
    key: String,
    nonce_hex: String,
    ciphertext_hex: String,
}

pub struct SecureVault;

impl SecureVault {
    /// Derive a 32-byte AES key from a PIN/password and a hex salt using Argon2.
    fn derive_key(pin: &str, salt_hex: &str) -> Result<[u8; 32]> {
        let salt_bytes = hex::decode(salt_hex).context("Failed to decode salt hex")?;
        let salt_string = SaltString::encode_b64(&salt_bytes)
            .map_err(|e| anyhow!("Failed to create SaltString: {}", e))?;

        let mut key = [0u8; 32];
        let argon2 = Argon2::default();
        argon2
            .hash_password_into(pin.as_bytes(), salt_string.as_str().as_bytes(), &mut key)
            .map_err(|e| anyhow!("Key derivation failed: {}", e))?;

        Ok(key)
    }

    /// Check if the vault has been set up (user account exists).
    pub async fn is_initialized(pool: &Pool<Sqlite>) -> Result<bool> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM user_auth WHERE id = 1")
            .fetch_one(pool)
            .await?;
        Ok(count.0 > 0)
    }

    /// Return the current status of the vault.
    pub async fn get_status(pool: &Pool<Sqlite>) -> Result<VaultStatus> {
        let user: Option<(String,)> = sqlx::query_as("SELECT username FROM user_auth WHERE id = 1")
            .fetch_optional(pool)
            .await?;

        let is_unlocked = ACTIVE_KEY.read().await.is_some();

        match user {
            Some((username,)) => Ok(VaultStatus {
                is_initialized: true,
                is_unlocked,
                username: Some(username),
            }),
            None => Ok(VaultStatus {
                is_initialized: false,
                is_unlocked: false,
                username: None,
            }),
        }
    }

    /// Set up a new vault with a username and master PIN/passphrase.
    /// If already initialized, requires the vault to be unlocked and re-encrypts
    /// all existing vault entries under the new key.
    pub async fn setup(pool: &Pool<Sqlite>, username: &str, pin: &str) -> Result<()> {
        if pin.len() < 4 {
            return Err(anyhow!("PIN must be at least 4 characters long"));
        }

        let already_initialized = Self::is_initialized(pool).await?;
        let mut decrypted_entries: Vec<(String, Vec<u8>)> = Vec::new();

        if already_initialized {
            let old_key = {
                let guard = ACTIVE_KEY.read().await;
                match *guard {
                    Some(k) => k,
                    None => return Err(VaultError::Locked.into()),
                }
            };

            let old_cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&old_key));
            let entries: Vec<VaultEntryRow> =
                sqlx::query_as("SELECT key, nonce_hex, ciphertext_hex FROM vault_entries")
                    .fetch_all(pool)
                    .await?;

            for entry in entries {
                let nonce_bytes = hex::decode(&entry.nonce_hex)?;
                let ciphertext_bytes = hex::decode(&entry.ciphertext_hex)?;
                let nonce = Nonce::from_slice(&nonce_bytes);
                let decrypted = old_cipher
                    .decrypt(nonce, ciphertext_bytes.as_ref())
                    .map_err(|e| anyhow!("Failed to decrypt entry '{}': {}", entry.key, e))?;
                decrypted_entries.push((entry.key, decrypted));
            }
        }

        // Generate 16 bytes of random salt
        let mut salt_bytes = [0u8; 16];
        OsRng.fill_bytes(&mut salt_bytes);
        let salt_hex = hex::encode(salt_bytes);

        // Compute verification password hash using Argon2
        let salt_string = SaltString::encode_b64(&salt_bytes)
            .map_err(|e| anyhow!("Failed to create SaltString: {}", e))?;
        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(pin.as_bytes(), &salt_string)
            .map_err(|e| anyhow!("Failed to hash password: {}", e))?
            .to_string();

        // Derive the active AES key
        let key = Self::derive_key(pin, &salt_hex)?;
        let new_cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));

        let mut tx = pool.begin().await?;

        // Store user auth row
        sqlx::query(
            r#"
            INSERT INTO user_auth (id, username, password_hash, salt_hex, created_at, updated_at)
            VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                username = excluded.username,
                password_hash = excluded.password_hash,
                salt_hex = excluded.salt_hex,
                updated_at = CURRENT_TIMESTAMP
            "#,
        )
        .bind(username)
        .bind(&password_hash)
        .bind(&salt_hex)
        .execute(&mut *tx)
        .await?;

        // Re-encrypt any existing entries with the new key
        for (entry_key, plaintext_bytes) in decrypted_entries {
            let mut nonce_bytes = [0u8; 12];
            OsRng.fill_bytes(&mut nonce_bytes);
            let nonce = Nonce::from_slice(&nonce_bytes);
            let ciphertext = new_cipher
                .encrypt(nonce, plaintext_bytes.as_slice())
                .map_err(|e| anyhow!("Re-encryption error: {}", e))?;

            sqlx::query(
                "UPDATE vault_entries SET nonce_hex = ?, ciphertext_hex = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
            )
            .bind(hex::encode(nonce_bytes))
            .bind(hex::encode(ciphertext))
            .bind(&entry_key)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;

        // Unlock in memory
        *ACTIVE_KEY.write().await = Some(key);

        tracing::info!("Vault initialized and unlocked for user: {}", username);
        Ok(())
    }

    /// Unlock the vault using the user PIN/passphrase.
    pub async fn unlock(pool: &Pool<Sqlite>, pin: &str) -> Result<String> {
        let user: UserAuthRow = sqlx::query_as(
            "SELECT username, password_hash, salt_hex FROM user_auth WHERE id = 1",
        )
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| anyhow!("Vault has not been initialized. Please set up a user first."))?;

        // Verify PIN against stored hash
        let parsed_hash = PasswordHash::new(&user.password_hash)
            .map_err(|e| anyhow!("Invalid password hash in db: {}", e))?;

        Argon2::default()
            .verify_password(pin.as_bytes(), &parsed_hash)
            .map_err(|_| anyhow!("Invalid PIN / password"))?;

        // Derive and store active AES key
        let key = Self::derive_key(pin, &user.salt_hex)?;
        *ACTIVE_KEY.write().await = Some(key);

        tracing::info!("Vault unlocked successfully for user: {}", user.username);
        Ok(user.username)
    }

    /// Lock the vault by zeroizing and discarding the active key from memory.
    pub async fn lock() {
        let mut guard = ACTIVE_KEY.write().await;
        if let Some(ref mut bytes) = *guard {
            bytes.fill(0);
        }
        *guard = None;
        tracing::info!("Vault locked");
    }

    /// Save an encrypted JSON string payload under a given key.
    pub async fn save_data(pool: &Pool<Sqlite>, key: &str, plaintext: &str) -> Result<()> {
        let key_guard = ACTIVE_KEY.read().await;
        let aes_key_bytes = key_guard
            .as_ref()
            .ok_or_else(|| anyhow!("Vault is locked. Cannot encrypt data."))?;

        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(aes_key_bytes));

        // Generate 12-byte random nonce
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Encrypt payload
        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| anyhow!("Encryption error: {}", e))?;

        let nonce_hex = hex::encode(nonce_bytes);
        let ciphertext_hex = hex::encode(ciphertext);

        sqlx::query(
            r#"
            INSERT INTO vault_entries (key, nonce_hex, ciphertext_hex, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                nonce_hex = excluded.nonce_hex,
                ciphertext_hex = excluded.ciphertext_hex,
                updated_at = CURRENT_TIMESTAMP
            "#,
        )
        .bind(key)
        .bind(&nonce_hex)
        .bind(&ciphertext_hex)
        .execute(pool)
        .await?;

        tracing::debug!("Encrypted and saved vault key: {}", key);
        Ok(())
    }

    /// Load and decrypt a JSON string payload from the given key.
    pub async fn load_data(pool: &Pool<Sqlite>, key: &str) -> Result<Option<String>> {
        let key_guard = ACTIVE_KEY.read().await;
        let aes_key_bytes = key_guard
            .as_ref()
            .ok_or_else(|| anyhow!("Vault is locked. Cannot decrypt data."))?;

        let entry: Option<VaultEntryRow> = sqlx::query_as(
            "SELECT key, nonce_hex, ciphertext_hex FROM vault_entries WHERE key = ?",
        )
        .bind(key)
        .fetch_optional(pool)
        .await?;

        let row = match entry {
            Some(r) => r,
            None => return Ok(None),
        };

        let nonce_bytes = hex::decode(&row.nonce_hex).context("Failed to decode nonce hex")?;
        let ciphertext_bytes =
            hex::decode(&row.ciphertext_hex).context("Failed to decode ciphertext hex")?;

        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(aes_key_bytes));
        let nonce = Nonce::from_slice(&nonce_bytes);

        let decrypted_bytes = cipher
            .decrypt(nonce, ciphertext_bytes.as_ref())
            .map_err(|e| anyhow!("Decryption error: {}", e))?;

        let plaintext = String::from_utf8(decrypted_bytes)
            .context("Decrypted data is not valid UTF-8 string")?;

        Ok(Some(plaintext))
    }

    /// Delete an entry from the vault (requires vault to be unlocked).
    pub async fn delete_data(pool: &Pool<Sqlite>, key: &str) -> Result<bool> {
        if ACTIVE_KEY.read().await.is_none() {
            return Err(VaultError::Locked.into());
        }
        let result = sqlx::query("DELETE FROM vault_entries WHERE key = ?")
            .bind(key)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Change the user PIN and re-encrypt all existing vault entries.
    pub async fn change_pin(
        pool: &Pool<Sqlite>,
        old_pin: &str,
        new_pin: &str,
    ) -> Result<()> {
        if new_pin.len() < 4 {
            return Err(anyhow!("New PIN must be at least 4 characters long"));
        }

        // Verify old PIN
        let user: UserAuthRow = sqlx::query_as(
            "SELECT username, password_hash, salt_hex FROM user_auth WHERE id = 1",
        )
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| anyhow!("Vault not initialized"))?;

        let parsed_hash = PasswordHash::new(&user.password_hash)
            .map_err(|e| anyhow!("Invalid hash format: {}", e))?;

        Argon2::default()
            .verify_password(old_pin.as_bytes(), &parsed_hash)
            .map_err(|_| anyhow!("Current PIN is incorrect"))?;

        // Old key
        let old_key = Self::derive_key(old_pin, &user.salt_hex)?;
        let old_cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&old_key));

        // Read all entries and decrypt them with old key
        let entries: Vec<VaultEntryRow> =
            sqlx::query_as("SELECT key, nonce_hex, ciphertext_hex FROM vault_entries")
                .fetch_all(pool)
                .await?;

        let mut decrypted_entries = Vec::new();
        for entry in entries {
            let nonce_bytes = hex::decode(&entry.nonce_hex)?;
            let ciphertext_bytes = hex::decode(&entry.ciphertext_hex)?;
            let nonce = Nonce::from_slice(&nonce_bytes);
            let decrypted = old_cipher
                .decrypt(nonce, ciphertext_bytes.as_ref())
                .map_err(|e| anyhow!("Failed to decrypt entry '{}': {}", entry.key, e))?;
            decrypted_entries.push((entry.key, decrypted));
        }

        // Generate new salt and new Argon2 hash
        let mut new_salt_bytes = [0u8; 16];
        OsRng.fill_bytes(&mut new_salt_bytes);
        let new_salt_hex = hex::encode(new_salt_bytes);
        let new_salt_string = SaltString::encode_b64(&new_salt_bytes)
            .map_err(|e| anyhow!("Salt error: {}", e))?;

        let new_password_hash = Argon2::default()
            .hash_password(new_pin.as_bytes(), &new_salt_string)
            .map_err(|e| anyhow!("Hash error: {}", e))?
            .to_string();

        let new_key = Self::derive_key(new_pin, &new_salt_hex)?;
        let new_cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&new_key));

        // Re-encrypt all entries
        let mut tx = pool.begin().await?;

        sqlx::query(
            "UPDATE user_auth SET password_hash = ?, salt_hex = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
        )
        .bind(&new_password_hash)
        .bind(&new_salt_hex)
        .execute(&mut *tx)
        .await?;

        for (key, plaintext_bytes) in decrypted_entries {
            let mut nonce_bytes = [0u8; 12];
            OsRng.fill_bytes(&mut nonce_bytes);
            let nonce = Nonce::from_slice(&nonce_bytes);
            let ciphertext = new_cipher
                .encrypt(nonce, plaintext_bytes.as_slice())
                .map_err(|e| anyhow!("Re-encryption error: {}", e))?;

            sqlx::query(
                "UPDATE vault_entries SET nonce_hex = ?, ciphertext_hex = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
            )
            .bind(hex::encode(nonce_bytes))
            .bind(hex::encode(ciphertext))
            .bind(&key)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;

        // Update active key in memory
        *ACTIVE_KEY.write().await = Some(new_key);
        tracing::info!("PIN changed and vault re-encrypted successfully");

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;
    use tokio::sync::Mutex;

    static TEST_MUTEX: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

    async fn setup_test_db() -> Pool<Sqlite> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("Failed to connect to in-memory SQLite");

        sqlx::query(
            r#"
            CREATE TABLE user_auth (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                username TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                salt_hex TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE vault_entries (
                key TEXT PRIMARY KEY NOT NULL,
                nonce_hex TEXT NOT NULL,
                ciphertext_hex TEXT NOT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            "#,
        )
        .execute(&pool)
        .await
        .expect("Failed to create tables");

        pool
    }

    #[tokio::test]
    async fn test_vault_lifecycle() {
        let _guard = TEST_MUTEX.lock().await;
        SecureVault::lock().await;
        let pool = setup_test_db().await;

        // 1. Initial state
        let status = SecureVault::get_status(&pool).await.unwrap();
        assert!(!status.is_initialized);
        assert!(!status.is_unlocked);

        // 2. Setup
        SecureVault::setup(&pool, "TraderJoe", "secret123").await.unwrap();
        let status = SecureVault::get_status(&pool).await.unwrap();
        assert!(status.is_initialized);
        assert!(status.is_unlocked);
        assert_eq!(status.username.as_deref(), Some("TraderJoe"));

        // 3. Save and Load while unlocked
        let sample_json = r#"{"holdings":[{"symbol":"SPY","amount":10}],"cash":5000}"#;
        SecureVault::save_data(&pool, "portfolio_state", sample_json).await.unwrap();

        let loaded = SecureVault::load_data(&pool, "portfolio_state").await.unwrap();
        assert_eq!(loaded.as_deref(), Some(sample_json));

        // 4. Lock vault
        SecureVault::lock().await;
        let status = SecureVault::get_status(&pool).await.unwrap();
        assert!(status.is_initialized);
        assert!(!status.is_unlocked);

        // Reading while locked must fail
        assert!(SecureVault::load_data(&pool, "portfolio_state").await.is_err());
        assert!(SecureVault::save_data(&pool, "portfolio_state", "data").await.is_err());

        // 5. Unlock with wrong PIN must fail
        assert!(SecureVault::unlock(&pool, "wrong_pin").await.is_err());

        // 6. Unlock with correct PIN
        let user = SecureVault::unlock(&pool, "secret123").await.unwrap();
        assert_eq!(user, "TraderJoe");

        let loaded_again = SecureVault::load_data(&pool, "portfolio_state").await.unwrap();
        assert_eq!(loaded_again.as_deref(), Some(sample_json));

        // 7. Change PIN
        SecureVault::change_pin(&pool, "secret123", "new_secret_456").await.unwrap();

        // Check that data is still decryptable
        let reloaded = SecureVault::load_data(&pool, "portfolio_state").await.unwrap();
        assert_eq!(reloaded.as_deref(), Some(sample_json));

        // Lock and test unlock with new PIN
        SecureVault::lock().await;
        assert!(SecureVault::unlock(&pool, "secret123").await.is_err());
        assert!(SecureVault::unlock(&pool, "new_secret_456").await.is_ok());
    }

    #[tokio::test]
    async fn test_setup_when_initialized_and_locked_fails() {
        let _guard = TEST_MUTEX.lock().await;
        SecureVault::lock().await;
        let pool = setup_test_db().await;

        SecureVault::setup(&pool, "Alice", "pin1234").await.unwrap();
        SecureVault::save_data(&pool, "secret_key", "sensitive_payload")
            .await
            .unwrap();

        // Lock vault
        SecureVault::lock().await;

        // Unauthenticated setup call must fail with VaultError::Locked
        let err = SecureVault::setup(&pool, "Attacker", "newpin9999")
            .await
            .unwrap_err();
        assert_eq!(err.downcast_ref::<VaultError>(), Some(&VaultError::Locked));

        // Original user can still unlock and read data
        let username = SecureVault::unlock(&pool, "pin1234").await.unwrap();
        assert_eq!(username, "Alice");
        let data = SecureVault::load_data(&pool, "secret_key").await.unwrap();
        assert_eq!(data.as_deref(), Some("sensitive_payload"));
    }

    #[tokio::test]
    async fn test_setup_when_initialized_and_unlocked_reencrypts_entries() {
        let _guard = TEST_MUTEX.lock().await;
        SecureVault::lock().await;
        let pool = setup_test_db().await;

        SecureVault::setup(&pool, "Alice", "pin1234").await.unwrap();
        SecureVault::save_data(&pool, "k1", "value_one").await.unwrap();
        SecureVault::save_data(&pool, "k2", "value_two").await.unwrap();

        // Re-running setup while unlocked should re-encrypt all entries under the new PIN
        SecureVault::setup(&pool, "AliceUpdated", "new_pin_5678")
            .await
            .unwrap();

        // Lock and unlock with new PIN
        SecureVault::lock().await;
        assert!(SecureVault::unlock(&pool, "pin1234").await.is_err());
        let user = SecureVault::unlock(&pool, "new_pin_5678").await.unwrap();
        assert_eq!(user, "AliceUpdated");

        assert_eq!(
            SecureVault::load_data(&pool, "k1").await.unwrap().as_deref(),
            Some("value_one")
        );
        assert_eq!(
            SecureVault::load_data(&pool, "k2").await.unwrap().as_deref(),
            Some("value_two")
        );
    }

    #[tokio::test]
    async fn test_delete_data_when_locked_fails() {
        let _guard = TEST_MUTEX.lock().await;
        SecureVault::lock().await;
        let pool = setup_test_db().await;

        SecureVault::setup(&pool, "Alice", "pin1234").await.unwrap();
        SecureVault::save_data(&pool, "portfolio_state", "{}").await.unwrap();

        SecureVault::lock().await;

        let err = SecureVault::delete_data(&pool, "portfolio_state")
            .await
            .unwrap_err();
        assert_eq!(err.downcast_ref::<VaultError>(), Some(&VaultError::Locked));

        // Unlock and verify entry was not deleted
        SecureVault::unlock(&pool, "pin1234").await.unwrap();
        assert_eq!(
            SecureVault::load_data(&pool, "portfolio_state")
                .await
                .unwrap()
                .as_deref(),
            Some("{}")
        );
        assert!(SecureVault::delete_data(&pool, "portfolio_state").await.unwrap());
    }
}
