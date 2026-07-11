const express = require("express");
const router = express.Router();
const turnos = require("../controllers/turnos");

router.post("/turnos", 
    turnos.vista);

module.exports = router;