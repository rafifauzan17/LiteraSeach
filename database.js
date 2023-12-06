import mysql from "mysql2";

const pool = mysql
  .createPool({
    connectionLimit: 10,
    host: "34.101.212.167",
    user: "root",
    password: "", //password deleted
    database: "Books",
  })
  .promise();

export async function getBooks() {
  const [rows] = await pool.query(
    "SELECT bookId, title, authors, num_pages FROM books"
  );
  return rows;
}

export async function getBook(title) {
  const [rows] = await pool.query(
    "SELECT bookId, title, authors, num_pages FROM books WHERE title COLLATE utf8mb4_general_ci LIKE ?",
    [`%${title}%`]
  );
  return rows;
}

export async function getPopularBooks() {
  const [rows] = await pool.query(
    "SELECT * FROM books ORDER BY text_reviews_count DESC LIMIT 15"
  );
  return rows;
}
