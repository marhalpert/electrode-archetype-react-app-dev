"use strict";

var archetype = require("../../archetype");
var mergeWebpackConfig = require("webpack-partial").default;
var SourceMapDevToolPlugin = require("webpack").SourceMapDevToolPlugin;

module.exports = function () {
  return function (config) {
    return mergeWebpackConfig(config, {
      plugins: [
        new SourceMapDevToolPlugin({
          filename: "../map/[file].map",
          append: `\n//# sourceMappingURL=http://${archetype.webpack.devHostname}:${archetype.webpack.devPort}/dist/map/[url]`
        })
      ]
    });
  };
};
