const express = require("express");
const router = express.Router();
const configuracion = require("../controllers/configuracion");
//const middlewares = require("../utils/middlewares");

router.get("/configuracion",
    async (req, res) => {
        let conf = configuracion.getConfig();
        res.status(200).json(conf);
    });

module.exports = router;