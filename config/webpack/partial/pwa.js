"use strict";

var archetype = require("../../archetype");
var Path = archetype.Path;
var AppMode = archetype.AppMode;

var assign = require("lodash/assign");
var mergeWebpackConfig = require("webpack-partial").default;
var fileLoader = require.resolve("file-loader");
var webAppManifestLoader = require.resolve("web-app-manifest-loader");
var SWPrecacheWebpackPlugin = require("sw-precache-webpack-plugin");
var FaviconsWebpackPlugin = require("../plugins/favicons");
var AddManifestFieldsPlugin = require('../plugins/add-manifest-fields');
var DiskPlugin = require('webpack-disk-plugin');
var optionalRequire = require("optional-require")(require);

var swConfigPath = Path.resolve("config", "sw-config.js");
var serverConfigPath = Path.resolve("config", "default.json");
var mkdirp = require("mkdirp");

/**
 * Takes a file path and returns a webpack-compatible
 * filename descriptor with a hash matching the current naming schema
 * @param  {string} filepath  original file path
 * @return {string}           parsed file path
 */
function getHashedPath(filepath) {
  var parsed = Path.parse(filepath);
  var name = parsed.name;
  var ext = parsed.ext;
  return name + '.[hash]' + ext;
}

/**
 * Takes a file path and returns a webpack-dev compatible
 * filename descriptor matching the current naming schema
 * @param  {string} filepath  original file path
 * @return {string}           parsed file path
 */
function getDevelopmentPath(filepath) {
  var parsed = Path.parse(filepath);
  var name = parsed.name;
  var ext = parsed.ext;
  return name + '.bundle.dev' + ext;
}

/**
 * Takes an array of strings representing scripts that
 * a service worker will import and returns an object
 * representing the webpack entry config. Each script
 * will get its own entry point so they can be independantly
 * imported by the service worker.
 * @param  {array<string>} importScripts
 * @param  {object}        current entry config
 * @return {object}        new entry config
 */
function createEntryConfigFromScripts(importScripts, entry) {
  // Handle the case where there might already be multiple
  // entry points. If it is we create a new object with all
  // existing entry points to avoid mutating the config. If its not,
  // we assume its a string and use it as the main entry point.
  var newEntry = typeof entry === "object"
    ? Object.assign({}, entry)
    : { main: entry };
  return importScripts.reduce(function (acc, script) {
    var name = Path.parse(script).name;
    acc[name] = script;
    return acc;
  }, newEntry);
}

module.exports = function () {
  return function (config) {
    var swConfig = optionalRequire(swConfigPath, true) || {};
    var severConfig = optionalRequire(serverConfigPath, true) || {};

    if (!swConfig.manifest) {
      return mergeWebpackConfig(config, {});
    }

    console.log(`Just FYI: PWA enabled with config from ${swConfigPath}`);

    mkdirp.sync(Path.resolve("dist"));

    var manifestConfig = assign({
      background: "#FFFFFF",
      logo: "images/electrode.png",
      title: "Electrode",
      short_name: "Electrode",
      statsFilename: "../server/iconstats.json"
    }, swConfig.manifest);

    var cacheConfig = assign({
      staticFileGlobs: [
        "dist/js/*.{js,css}"
      ],
      stripPrefix: "dist/js/",
      cacheId: "electrode",
      filepath: "dist/sw.js",
      maximumFileSizeToCacheInBytes: 4194304,
      skipWaiting: false
    }, swConfig.cache);

    if (cacheConfig.runtimeCaching) {
      cacheConfig.runtimeCaching = cacheConfig.runtimeCaching.map(function (runtimeCache) {
        return {
          handler: runtimeCache.handler,
          urlPattern: new RegExp(runtimeCache.urlPattern)
        }
      });
    }

    /**
     * If importScripts exists in the cache config we need to overwrite
     * the entry config and output config so we get an entry point for each
     * script with unique names.
     */
    var entry = config.entry;
    var output = config.output;
    if (cacheConfig.importScripts) {
      var importScripts = cacheConfig.importScripts;
      cacheConfig.importScripts = process.env.WEBPACK_DEV === "true"
        ? importScripts.map(getDevelopmentPath)
        : importScripts.map(getHashedPath);
      entry = createEntryConfigFromScripts(importScripts, entry);
      output = {
        filename: "[name].[hash].js"
      };
    }

    var logoPath = Path.resolve(AppMode.src.client, manifestConfig.logo);
    var plugins = [
      new FaviconsWebpackPlugin({
        logo: logoPath,
        emitStats: true,
        inject: false,
        background: manifestConfig.background,
        title: manifestConfig.title,
        statsFilename: manifestConfig.statsFilename,
        icons: {
          android: true,
          appleIcon: true,
          appleStartup: true,
          favicons: true
        }
      }),
      new AddManifestFieldsPlugin({
        gcm_sender_id: manifestConfig.gcm_sender_id,
        short_name: manifestConfig.short_name,
        theme_color: manifestConfig.theme_color
      }),
      new SWPrecacheWebpackPlugin(cacheConfig)
    ];

    /**
     * In dev we need to write the stats file to disk
     * so we can properly read which chunk(s) need to be
     * served. We write the stats file to our build artifacts
     * folder, which is .etmp by default.
     */
    if (process.env.WEBPACK_DEV === "true") {
      plugins.push(
        new DiskPlugin({
          output: {
            path: Path.resolve(severConfig.buildArtifactsPath || ".etmp")
          },
          files: [{
            asset: /\/stats.json$/,
            output: {
              filename: 'stats.json'
            }
          }]
        })
      );
    }

    return mergeWebpackConfig(config, {
      entry: entry,
      output: output,
      module: {
        rules: [
          {
            test: /manifest.json$/,
            use: [
              {
                loader: fileLoader,
                options: {
                  name: "manifest.json"
                }
              },
              webAppManifestLoader
            ]
          }
        ]
      },
      plugins: plugins
    });
  };
};
