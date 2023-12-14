const express = require("express");
const authRoutes = require("./routes/authRoutes");
const bookRoutes = require("./routes/booksRoutes");
const app = express();

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json")

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
