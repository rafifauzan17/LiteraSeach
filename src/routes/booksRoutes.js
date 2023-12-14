const express = require("express");
const router = express.Router();
const bookControllers = require("../controllers/bookControllers");

router.get("/all", bookControllers.getBooks);
router.get("/search/:any", bookControllers.getBook);
router.get("/popular", bookControllers.getPopularBooks);
router.get("/covers/:isbn", bookControllers.getBookCovers);
router.get("/info/:isbn", bookControllers.getBookInfo);
router.get("/subject/:subject", bookControllers.getBookSubject);

module.exports = router;
