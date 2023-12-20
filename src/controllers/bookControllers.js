const fetch = require("node-fetch");
const pool = require("../config/database");
const { response } = require("express");

async function getBooks(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  try {
    const start = (page - 1) * size;
    const [rows] = await pool.query(
      "SELECT title, author, isbn, publication_year, publisher, id_perpus FROM buku LIMIT ?, ?",
      [start, size]
    );

    const coverUrlsPromises = rows.map(async (row) => {
      const isbn = row.isbn;
      const coverUrl = `http://covers.openlibrary.org/b/isbn/${isbn}-S.jpg`;
      return coverUrl;
    });

    const coverUrls = await Promise.all(coverUrlsPromises);

    // Add coverUrls to the response
    const booksWithCovers = rows.map((book, index) => ({
      ...book,
      coverUrl: coverUrls[index],
    }));

    return res.status(200).json({ status: "success", data: booksWithCovers });
  } catch (error) {
    return res.status(500).json({ status: "fail", data: error });
  }
}

async function getBook(req, res) {
  const searchTerm = req.params.any;
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;

  if (searchTerm !== null) {
    try {
      const columns = ["title", "author", "publisher", "isbn"];
      const conditions = columns.map(
        (column) =>
          `${column} COLLATE utf8mb4_general_ci LIKE '%${searchTerm}%'`
      );

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" OR ")}` : "";

      const start = (page - 1) * size;

      const query = `SELECT title, author, isbn, publication_year, publisher, id_perpus,
                      CASE
                        WHEN title COLLATE utf8mb4_general_ci LIKE '%${searchTerm}%' THEN 'title'
                        WHEN author COLLATE utf8mb4_general_ci LIKE '%${searchTerm}%' THEN 'author'
                        WHEN publisher COLLATE utf8mb4_general_ci LIKE '%${searchTerm}%' THEN 'publisher'
                        WHEN isbn LIKE '%${searchTerm}%' THEN 'isbn'
                        ELSE NULL
                      END AS matched_column
                    FROM buku ${whereClause} LIMIT ?, ?`;

      const [rows] = await pool.query(query, [start, size]);

      const coverUrlsPromises = rows.map(async (row) => {
        const isbn = row.isbn;
        const coverUrl = `http://covers.openlibrary.org/b/isbn/${isbn}-S.jpg`;
        return coverUrl;
      });

      const coverUrls = await Promise.all(coverUrlsPromises);

      // Add coverUrls to the response
      const booksWithCovers = rows.map((book, index) => ({
        ...book,
        coverUrl: coverUrls[index],
      }));

      return res.status(200).json({ status: "success", data: booksWithCovers });
    } catch (error) {
      return res.status(500).json({ status: "fail", data: error });
    }
  } else {
    return res
      .status(404)
      .json({ status: "fail", message: "Buku tidak ditemukan" });
  }
}

async function getTopBooks(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  try {
    const topBooksUrl = "http://127.0.0.1:5000/books";
    const topBooksResponse = await fetch(topBooksUrl);
    const topBooksData = await topBooksResponse.json();

    const bookTitles = topBooksData.book_name;

    const titlePlaceholders = Array(bookTitles.length).fill("?").join(", ");

    const start = (page - 1) * size;
    const [rows] = await pool.query(
      `SELECT title, author, isbn, publication_year, publisher, id_perpus FROM buku WHERE title COLLATE utf8mb4_general_ci IN (${titlePlaceholders}) LIMIT ?, ?`,
      [...bookTitles, start, size]
    );

    const coverUrlsPromises = rows.map(async (row) => {
      const isbn = row.isbn;
      const coverUrl = `http://covers.openlibrary.org/b/isbn/${isbn}-S.jpg`;
      return coverUrl;
    });

    const coverUrls = await Promise.all(coverUrlsPromises);

    // Add coverUrls to the response
    const booksWithCovers = rows.map((book, index) => ({
      ...book,
      coverUrl: coverUrls[index],
    }));

    return res.status(200).json({ status: "success", data: booksWithCovers });
  } catch (error) {
    return res.status(500).json({ status: "fail", data: error });
  }
}

async function getBookInfo(req, res) {
  const isbn = req.params.isbn;

  try {
    const [rows] = await pool.query(
      "SELECT isbn, id_perpus FROM buku WHERE isbn LIKE ?",
      [[`%${isbn}%`]]
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ status: "fail", message: "ISBN tidak ditemukan" });
    }

    const idPerpus = rows.map((row) => {
      return row.id_perpus;
    });

    const keysUrls = rows.map((row) => {
      const isbn = row.isbn;
      return `https://openlibrary.org/isbn/${isbn}.json`;
    });

    // Make a request to the Open Library API to get keys
    const keyResponses = await Promise.all(
      keysUrls.map(async (url) => {
        const response = await fetch(url);
        return response.json();
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
          id_perpus: idPerpus || null,
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

async function getBooksSubject(req, res) {
  const subject = req.params.subject;
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;

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
    const start = (page - 1) * size;

    const placeholders = titleWithSubject.map(() => "?").join(", ");
    const [rows] = await pool.query(
      `SELECT DISTINCT title, author, isbn, publication_year, publisher, id_perpus FROM buku WHERE title COLLATE utf8mb4_general_ci IN (${placeholders}) LIMIT ?, ?`,
      [...titleWithSubject, start, size]
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

async function getTrendingBooks(req, res) {
  const trending = req.params.any || "daily";
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;

  try {
    const booksUrl = `https://openlibrary.org/trending/${trending}.json`;
    const booksUrlResponse = await fetch(booksUrl);
    const booksUrlData = await booksUrlResponse.json();

    const booksTitles = booksUrlData.works.map((work) => work.title);

    const titlePlaceholders = Array(booksTitles.length).fill("?").join(", ");

    const start = (page - 1) * size;
    const [rows] = await pool.query(
      `SELECT title, author, isbn, publication_year, publisher, id_perpus FROM buku WHERE title COLLATE utf8mb4_general_ci IN (${titlePlaceholders}) LIMIT ?, ?`,
      [...booksTitles, start, size]
    );

    const coverUrlsPromises = rows.map(async (row) => {
      const isbn = row.isbn;
      const coverUrl = `http://covers.openlibrary.org/b/isbn/${isbn}-S.jpg`;
      return coverUrl;
    });

    const coverUrls = await Promise.all(coverUrlsPromises);

    // Add coverUrls to the response
    const booksWithCovers = rows.map((book, index) => ({
      ...book,
      coverUrl: coverUrls[index],
    }));

    return res.status(200).json({ status: "success", data: booksWithCovers });
  } catch (error) {
    return res.status(500).json({ status: "fail", data: error });
  }
}

async function getLocation(req, res) {
  const latitude = req.query.latitude;
  const longitude = req.query.longitude;

  try {
    const locationRecommendation = await fetch(
      `http://127.0.0.1:5000/library_recommendation?latitude=${latitude}&longitude=${longitude}`
    );
    const locationData = await locationRecommendation.json();

    return res.status(200).json({ status: "success", data: locationData });
  } catch (error) {
    return res.status(500).json({ status: "fail", data: error });
  }
}

async function getLibraries(req, res) {
  try {
    const [rows] = await pool.query("SELECT * FROM perpustakaan");

    return res.status(200).json({ status: "success", data: rows });
  } catch (error) {
    return res.status(500).json({ status: "fail", data: error });
  }
}

async function getLibraryBooks(req, res) {
  const id_perpus = req.params.id_perpus;
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;

  try {
    const start = (page - 1) * size;
    const [rows] = await pool.query(
      "SELECT title, author, isbn, publication_year, publisher, id_perpus FROM buku WHERE id_perpus LIKE ? LIMIT ?, ?",
      [`%${id_perpus}%`, start, size]
    );

    return res.status(200).json({ status: "success", data: rows });
  } catch (error) {
    return res.status(500).json({ status: "fail", data: error });
  }
}

module.exports = {
  getBooks,
  getBook,
  getTopBooks,
  getBookInfo,
  getBooksSubject,
  getTrendingBooks,
  getLocation,
  getLibraries,
  getLibraryBooks,
};
