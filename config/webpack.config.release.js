"use strict";
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const ConfigBase = require("./webpack.config.base");

class Config extends ConfigBase {
  constructor() {
    super();
    this.mode = "production";
  }
}

module.exports = new Config();
