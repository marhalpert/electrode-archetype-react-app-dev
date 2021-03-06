"use strict";

var archetype = require("../../archetype");
var Path = archetype.Path;
var mergeWebpackConfig = require("webpack-partial").default;
const webpack = require("webpack");
var glob = require("glob");
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var CSSSplitPlugin = require("css-split-webpack-plugin").default;
// TODO: fix postcss for webpack 2.0
var atImport = require("postcss-import");
var cssnext = require("postcss-cssnext");

var autoprefixer = require("autoprefixer-stylus");
var cssLoader = require.resolve("css-loader");
var styleLoader = require.resolve("style-loader");
var stylusLoader = require.resolve("stylus-relative-loader");
var postcssLoader = require.resolve("postcss-loader");

var AppMode = archetype.AppMode;

/**
 * [cssModuleSupport By default, this archetype assumes you are using CSS-Modules + CSS-Next]
 *
 * Stylus is also supported for which the following cases can occur.
 *
 * case 1: *only* *.css exists => CSS-Modules + CSS-Next
 * case 2: *only* *.styl exists => stylus
 * case 3: *both* *.css & *.styl exists => CSS-Modules + CSS-Next takes priority
 *          with a warning message
 * case 4: *none* *.css & *.styl exists => CSS-Modules + CSS-Next takes priority
 * case 5: *cssModuleStylusSupport* config is true => Use both Stylus and CSS Modules
 */

var cssNextExists = (glob.sync(Path.resolve(AppMode.src.client, "**", "*.css")).length > 0);
var stylusExists = (glob.sync(Path.resolve(AppMode.src.client, "**", "*.styl")).length > 0);
var sassExists = (glob.sync(Path.resolve(AppMode.src.client, "**", "*.scss")).length > 0);

// By default, this archetype assumes you are using CSS-Modules + CSS-Next
var cssModuleSupport = true;

if (stylusExists && !cssNextExists) {
  cssModuleSupport = false;
}

module.exports = function () {
  return function (config) {
    var cssModuleStylusSupport = archetype.webpack.cssModuleStylusSupport;
    var stylusQuery = cssLoader + "?-autoprefixer!" + stylusLoader;
    var cssQuery = cssLoader + "?modules&-autoprefixer&localIdentName=[name]__[local]!" + postcssLoader;
    var cssStylusQuery = cssLoader + "?modules&-autoprefixer!" + postcssLoader + "!" + stylusLoader;

    // By default, this archetype assumes you are using CSS-Modules + CSS-Next
    var rules = [
      {
        test: /\.css$/,
        exclude: /\.module\.css$/,
        loader: ExtractTextPlugin.extract({fallback: styleLoader, use: cssLoader, publicPath: ""})
      },
      {
        test: /\.module\.css$/,
        loader: ExtractTextPlugin.extract({fallback: styleLoader, use: cssQuery, publicPath: ""})
      },
      {
        test: /\.scss$/,
        exclude: /\.module\.scss$/,
        loader: ExtractTextPlugin.extract({
          fallback: {
            loader: 'style-loader',
            options: {
              sourceMap: true
            }
          },
          use: [{
            loader: 'css-loader',
            options: {
              localIdentName: "[name]__[local]",
              sourceMap: true
            }
          }, {
            loader: 'postcss-loader',
            options: {
              sourceMap: true
            }
          }, {
            loader: 'sass-loader',
            options: {
              sourceMap: true,
              includePaths: [config.context]
            }
          }]
        })
      }, {
				test: /\.module\.scss$/,
        loader: ExtractTextPlugin.extract({
          fallback: {
            loader: 'style-loader',
            options: {
              sourceMap: true
            }
          },
          use: [{
            loader: 'css-loader',
            options: {
              modules: true,
              localIdentName: "[name]__[local]",
              sourceMap: true
            }
          }, {
            loader: 'postcss-loader',
            options: {
              sourceMap: true
            }
          }, {
            loader: 'sass-loader',
            options: {
              sourceMap: true,
              includePaths: [config.context]
            }
          }]
        })
      }
    ];

    if (cssModuleStylusSupport) {
      rules.push({
        test: /\.styl$/,
        loader: ExtractTextPlugin.extract({fallback: styleLoader, use: cssStylusQuery, publicPath: "" })
      });
    } else if (!cssModuleSupport) {
      rules.push({
        test: /\.styl$/,
        loader: ExtractTextPlugin.extract({fallback: styleLoader, use: stylusQuery, publicPath: ""})
      });
    }

    return mergeWebpackConfig(config, {
      module: {rules},
      plugins: [
        new ExtractTextPlugin({filename: "[name].style.[hash].css"}),

        /*
         preserve: default: false. Keep the original unsplit file as well.
         Sometimes this is desirable if you want to target a specific browser (IE)
         with the split files and then serve the unsplit ones to everyone else.
         */
        new CSSSplitPlugin({size: 4000, imports: true, preserve: true}),
        new webpack.LoaderOptionsPlugin({
          options: {
            postcss: function () {
              return cssModuleSupport ? [atImport, cssnext({
                browsers: ["last 2 versions", "ie >= 9", "> 5%"]
              })] : [];
            },
            stylus: {
              use: function () {
                return !cssModuleSupport ? [autoprefixer({
                  browsers: ["last 2 versions", "ie >= 9", "> 5%"]
                })] : [];
              }
            }
          }
        })
      ]
    });
  };
};
