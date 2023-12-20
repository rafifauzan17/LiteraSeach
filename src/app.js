const express = require("express");
const authRoutes = require("./routes/authRoutes");
const bookRoutes = require("./routes/booksRoutes");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/books", bookRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`LiteraSearch app listening on port ${PORT}`);
});
