const router = require("express").Router();
const NewsHelper = require("../../util/newsHelper");

//get routes
router.get("/article/:id", (req, res) => {
  let article_id = new String(req.params.id);
  let my_helper = new NewsHelper();
  res.json(my_helper.getNewsById(article_id));
});

//post routes

module.exports = router;
