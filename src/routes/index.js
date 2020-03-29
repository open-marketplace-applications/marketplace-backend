var router = require("express").Router();

router.use("/news", require("./news"));

module.exports = router;
