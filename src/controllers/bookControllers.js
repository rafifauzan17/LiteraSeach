const fetch = require("node-fetch");
const pool = require("../config/database");
const { response } = require("express");

async function getBooks(req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT title, author, isbn, publication_year, publisher FROM Book LIMIT 1000"
    );
    return res.status(200).json({ status: "success", data: rows });
  } catch (error) {
    return res.status(500).json({ status: "fail", data: error });
  }
}

async function getBook(req, res) {
  const searchTerm = req.params.any;

  if (searchTerm !== null) {
    try {
      const columns = ["title", "author", "publisher", "isbn"];
      const conditions = columns.map(
        (column) =>
          `${column} COLLATE utf8mb4_general_ci LIKE '%${searchTerm}%'`
      );

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" OR ")}` : "";

      const query = `SELECT title, author, isbn, publication_year, publisher, 
                      CASE
                        WHEN title COLLATE utf8mb4_general_ci LIKE '%${searchTerm}%' THEN 'title'
                        WHEN author COLLATE utf8mb4_general_ci LIKE '%${searchTerm}%' THEN 'author'
                        WHEN publisher COLLATE utf8mb4_general_ci LIKE '%${searchTerm}%' THEN 'publisher'
                        WHEN isbn LIKE '%${searchTerm}%' THEN 'isbn'
                        ELSE NULL
                      END AS matched_column
                    FROM Book ${whereClause}`;

      const [rows] = await pool.query(query);
      return res.status(200).json({ status: "success", data: rows });
    } catch (error) {
      return res.status(500).json({ status: "fail", data: error });
    }
  } else {
    return res
      .status(404)
      .json({ status: "fail", message: "Buku tidak ditemukan" });
  }
}

async function getPopularBooks(req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT title, author, isbn, publication_year, publisher FROM Book ORDER BY average_rating DESC LIMIT 15"
    );
    return res.status(200).json({ status: "success", data: rows });
  } catch (error) {
    return res.status(500).json({ status: "fail", data: error });
  }
}

async function getBookCovers(req, res) {
  const isbn = req.params.isbn;
  try {
    const [rows] = await pool.query("SELECT isbn FROM Book WHERE isbn LIKE ?", [
      [`%${isbn}%`],
    ]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ status: "fail", message: "ISBN tidak ditemukan" });
    }

    const keysUrls = rows.map((row) => {
      const isbn = row.isbn;
      return `http://covers.openlibrary.org/b/isbn/${isbn}-S.jpg`;
    });

    const response = await fetch(keysUrls);

    if (!response.headers.get("content-type").includes("application/json")) {
      res.setHeader("Content-Type", "image/jpeg");
      response.body.pipe(res);
    } else {
      res
        .status(404)
        .json({ status: "fail", message: "Gambar tidak ditemukan" });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ status: "fail", message: "Buku tidak ditemukan" });
  }
}

async function getBookInfo(req, res) {
  const isbn = req.params.isbn;

  try {
    const [rows] = await pool.query("SELECT isbn FROM Book WHERE isbn LIKE ?", [
      [`%${isbn}%`],
    ]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ status: "fail", message: "ISBN tidak ditemukan" });
    }

    const keysUrls = rows.map((row) => {
      const isbn = row.isbn;
      return `https://openlibrary.org/isbn/${isbn}.json`;
    });

    // Make a request to the Open Library API to get keys
    const keyResponses = await Promise.all(
      keysUrls.map(async (url) => {
        const response = await fetch(url);
        return response.json(); // Assuming the response is in JSON format
      })
    );

    const extractedKeys = keyResponses.map((response) => response.works);

    const descriptionResponses = await Promise.all(
      extractedKeys.map(async (key) => {
        const keys = key.map((work) => work.key);
        const response = await fetch(`https://openlibrary.org${keys}.json`);
        return response.json();
      })
    );

    const extractedDescriptions = descriptionResponses.map((response) => {
      return [
        {
          subjects: response?.subjects || null,
          description: response?.description || null,
        },
      ];
    });

    res.status(200).json({ status: "success", data: extractedDescriptions });
  } catch (error) {
    console.error("Error:", error);
    return res
      .status(500)
      .json({ status: "fail", message: "Buku tidak ditemukan" });
  }
}

async function getBookSubject(req, res) {
  const subject = req.params.subject;

  try {
    const subjectApiUrl = `http://openlibrary.org/subjects/${subject}.json`;
    const subjectApiResponse = await fetch(subjectApiUrl);
    const subjectApiData = await subjectApiResponse.json();

    if (!subjectApiData.works || subjectApiData.works.length === 0) {
      return res.status(404).json({
        status: "fail",
        message: "No books found for the specified subject",
      });
    }

    const titleWithSubject = subjectApiData.works.map((work) => work.title);

    const placeholders = titleWithSubject.map(() => "?").join(", ");
    console.log(placeholders);

    const [rows] = await pool.query(
      `SELECT DISTINCT title, author, isbn, publication_year, publisher FROM Book WHERE title COLLATE utf8mb4_general_ci IN (${placeholders}) `,
      titleWithSubject
    );

    if (rows.length > 0) {
      res.status(200).json({
        status: "success",
        message: "Matches found in the database",
        data: rows,
      });
    } else {
      res.status(404).json({
        status: "fail",
        message: "No matches found in the database",
      });
    }
  } catch (error) {
    console.error("Error checking result with database:", error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

module.exports = {
  getBooks,
  getBook,
  getPopularBooks,
  getBookCovers,
  getBookInfo,
  getBookSubject,
};
