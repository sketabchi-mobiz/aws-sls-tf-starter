"use strict";

/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const fs = require("fs");
const TerserPlugin = require("terser-webpack-plugin");

const ext = process.env.npm_package_config_code_extension;
console.log(`code_extension is set to '${ext}'`);
console.log("Starting webpack build...");

class ConfigBase {
  constructor() {
    this.optimization = {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            keep_classnames: true,
            keep_fnames: true
          }
        })
      ]
    };

    this.stats = {
      // Configure the console output
      errorDetails: true,
      colors: true,
      reasons: true,
      modules: false,
      children: false,
      chunks: false,
      chunkGroups: false,
      chunkOrigins: false
    };

    this.target = "node";

    // Read in all of the files in the Handlers directory.
    // These are the entrypoints and we will create a webpack bundle for each one.
    let handlersDir = "./src/_lambda-handlers";
    if (ext === "js") {
      handlersDir = "./src_js/_lambda-handlers";
    }
    const files = fs.readdirSync(handlersDir);

    const entries = {};
    files.forEach(function (filename) {
      // Each file in the _lambda-handlers directory is an "entry" point
      // Except for the .spec files
      if (!filename.match(/\.spec\.[jt]s/i)) {
        entries[filename.split(".")[0]] = `${handlersDir}/${filename}`;
      }
    });

    this.entry = entries;

    this.output = {
      libraryTarget: "commonjs2",
      path: path.resolve(__dirname, "../dist"),
      filename: "[name]/handler.js"
    };

    this.resolve = {
      extensions: [".js", ".json"]
    };

    this.module = {
      rules: []
    };

    if (ext !== "js") {
      // if not js, then we assume ts and add the necessary extension for ts
      this.resolve.extensions.push(".ts");
      this.module.rules.push({
        test: /\.ts$/,
        use: "ts-loader"
      });
    }
  }
}

module.exports = ConfigBase;
