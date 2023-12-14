const express = require("express");
const router = express.Router();
const authController = require("../controllers/authControllers");

router.post("/signin", authController.signInWithCustomToken);

module.exports = router;
