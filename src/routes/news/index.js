const router = require("express").Router();
const NewsHelper = require("../../util/newsHelper");

let my_news_helper = new NewsHelper();
//get routes

//get news by article id
router.get("/article/:id", (req, res) => {
  let article_id = new String(req.params.id);
  let data = my_news_helper.getNewsById(article_id);
  res.json(data);
});
//get news by publisher id
router.get("/publisher/:id", (req, res) => {
  let article_id = req.params.id;
  let data = my_news_helper.getNewsByPublisher(article_id);
  res.json(data);
});
//get news by type
router.get("/type/:id", (req, res) => {
  let article_type = parseInt(req.params.id);
  let data = my_news_helper.getNewsByType(article_type);
  res.json(data);
});

//post routes
router.post("/new/", function(req, res) {
  let publisher_id = req.body.id;
  let title = req.body.title;
  let content = req.body.content;
  my_news_helper.addNews(publisher_id, {
    title,
    content
  });
});

module.exports = router;
