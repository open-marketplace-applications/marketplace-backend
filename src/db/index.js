const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

class DB {
  constructor(db_name) {
    this.db_name = db_name;
    this.adapter = new FileSync(db_name + ".json");
    this.db = low(this.adapter);
    this.isFormatted = false;
  }
  put(table, data) {
    if (!this.isFormatted)
      throw new Error("Please set the format of your db first,use setDefaults");
    this.db
      .get(table)
      .push(data)
      .write();
  }
  get(table) {
    return this.db.get(table);
  }
  setDefaults(data) {
    this.db.defaults(data).write();
    this.isFormatted = true;
  }
}
module.exports = DB;
