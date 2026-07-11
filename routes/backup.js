const express = require("express");
const router = express.Router();
const backup = require("../controllers/backup");

router.get("/backup",
    async (req, res) => {
        await backup.backup(req, res);
    });

module.exports = router;