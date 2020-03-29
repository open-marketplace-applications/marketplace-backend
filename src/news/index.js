const DB = require("../db/");
var _ = require("lodash");

const randomstring = require("randomstring");
class NewsHelper {
  constructor() {
    this.my_db = new DB("newsdb");
    this.my_db.setDefaults({ news: [] });
  }
  addNews(publisher_id, news) {
    let time = Date.now();
    let title = news.title;
    let content = news.content;
    let type = this.getPublisher(publisher_id).type;

    let article_id = randomstring.generate({
      length: 8,
      capitalization: "uppercase"
    });
    //todo: check if aticel_id exists already ?
    this.my_db.put("news", {
      time,
      type,
      publisher_id,
      article_id,
      title,
      content
    });
  }
  getNewsByPublisher(publisher_id) {
    let data = this.my_db.get("news").value();
    return _.filter(data, o => {
      return (o.publisher_id = publisher_id);
    });
  }
  getNewsByType(type) {
    let data = this.my_db.get("news").value();
    return _.filter(data, o => {
      return (o.type = type);
    });
  }
  getNewsByTime(time) {
    let data = this.my_db.get("news").value();
    return _.filter(data, o => {
      return o.time > Date.now();
    });
  }
  getNewsById(article_id) {
    let data = this.my_db.get("news").value();
    return _.find(data, o => {
      return (o.article_id = article_id);
    });
  }
  //todo:optimize results
  findNews(queryObject) {
    let data = this.my_db.get("news").value();
    return _.filter(data, queryObject);
  }
  //get publisher details form db
  getPublisher(publisher_id) {
    //todo: load publisher db
    return { type: 0 };
  }
}
module.exports = NewsHelper;
