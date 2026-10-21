import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from your .env file.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

// Create the tables the app needs.
export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vendor TEXT NOT NULL DEFAULT '',
      total NUMERIC(12, 2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS receipt_items (
      id TEXT PRIMARY KEY,
      receipt_id TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price NUMERIC(12, 2)
    );

    CREATE TABLE IF NOT EXISTS stock_batches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      supplier TEXT NOT NULL DEFAULT '',
      quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'piece',
      purchase_price NUMERIC(12, 2),
      selling_price NUMERIC(12, 2),
      supplied_at DATE NOT NULL,
      expires_at DATE
    );
  `);
}

export async function findUserByEmail(email) {
  const result = await pool.query(
    `SELECT id, name, email, password_hash, password_salt
     FROM users
     WHERE email = $1`,
    [email],
  );

  return result.rows[0];
}

export async function createUser({ id, name, email, passwordHash, passwordSalt }) {
  const result = await pool.query(
    `INSERT INTO users (id, name, email, password_hash, password_salt)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email`,
    [id, name, email, passwordHash, passwordSalt],
  );

  return result.rows[0];
}

export async function findSession(sessionId) {
  const result = await pool.query(
    `SELECT sessions.id, users.id AS user_id, users.name, users.email
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = $1
     AND sessions.expires_at > NOW()`,
    [sessionId],
  );

  return result.rows[0];
}

export async function createSession({ id, userId, expiresAt }) {
  await pool.query(
    `INSERT INTO sessions (id, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [id, userId, expiresAt],
  );
}

export async function deleteSession(sessionId) {
  await pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

export async function createReceipt({ id, userId, vendor, total, items }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO receipts (id, user_id, vendor, total)
       VALUES ($1, $2, $3, $4)`,
      [id, userId, vendor, total || null],
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO receipt_items (id, receipt_id, name, price)
         VALUES ($1, $2, $3, $4)`,
        [item.id, id, item.name || "Unnamed item", item.price || null],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listReceiptsByUser(userId) {
  const result = await pool.query(
    `SELECT
       receipts.id,
       receipts.vendor,
       receipts.total,
       receipts.created_at AS "createdAt",
       COALESCE(
         json_agg(
           json_build_object(
             'name', receipt_items.name,
             'price', receipt_items.price
           )
         ) FILTER (WHERE receipt_items.id IS NOT NULL),
         '[]'
       ) AS items
     FROM receipts
     LEFT JOIN receipt_items
       ON receipt_items.receipt_id = receipts.id
     WHERE receipts.user_id = $1
     GROUP BY receipts.id
     ORDER BY receipts.created_at DESC`,
    [userId],
  );

  return result.rows;
}

export async function createStockBatch({
  id,
  userId,
  productName,
  supplier,
  quantity,
  unit,
  purchasePrice,
  sellingPrice,
  suppliedAt,
  expiresAt,
}) {
  await pool.query(
    `INSERT INTO stock_batches
      (id, user_id, product_name, supplier, quantity, unit,
       purchase_price, selling_price, supplied_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      userId,
      productName,
      supplier,
      quantity,
      unit,
      purchasePrice || null,
      sellingPrice || null,
      suppliedAt,
      expiresAt || null,
    ],
  );
}

export async function listStockBatchesByUser(userId) {
  const result = await pool.query(
    `SELECT
       id,
       product_name AS "productName",
       supplier,
       quantity,
       unit,
       purchase_price AS "purchasePrice",
       selling_price AS "sellingPrice",
       supplied_at AS "suppliedAt",
       expires_at AS "expiresAt"
     FROM stock_batches
     WHERE user_id = $1
     AND quantity > 0
     ORDER BY supplied_at ASC`,
    [userId],
  );

  return result.rows;
}

export async function closeDatabase() {
  await pool.end();
}
