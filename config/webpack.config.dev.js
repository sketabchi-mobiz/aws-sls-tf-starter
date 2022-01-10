"use strict";
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const ConfigBase = require("./webpack.config.base");

class Config extends ConfigBase {
  constructor() {
    super();

    this.output.devtoolModuleFilenameTemplate = "[absolute-resource-path]";
    this.output.devtoolFallbackModuleFilenameTemplate = "[absolute-resource-path]?[hash]";

    this.devtool = "source-map";
    this.mode = "development";
  }
}

module.exports = new Config();
