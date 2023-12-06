import express from "express";
import { getBooks, getPopularBooks, getBook } from "./database.js";

const app = express();

app.use(express.json());

app.get("/books", async (req, res) => {
  const books = await getBooks();
  res.send(books);
});

app.get("/books/:title", async (req, res) => {
  const title = req.params.title;

  try {
    const result = await getBook(title);
    res.status(200).send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/popular", async (req, res) => {
  const books = await getPopularBooks();
  res.status(200).send(books); // Corrected status code to 200
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log("Server is running on port 8080");
});
