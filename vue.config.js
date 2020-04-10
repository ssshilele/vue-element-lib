const webpack = require('webpack');
const path = require('path');

function resolve (dir) {
  return path.join(__dirname, dir)
}

module.exports = {
  devServer: {
    // 本地服务器代理
    proxy: {
      '/proxy/api/v1': {
        target: 'http://test.vue-element-lib:8080/',
        changeOrigin: true, // 是否跨域
        pathRewrite: { // 覆写路径
          '^/proxy': ''
        }
      }
    }
  },

  chainWebpack: config => {
    // 从现有的 svg loader 中排除掉 src/assets/icons 目录下的加载
    config.module
      .rule('svg')
      .exclude.add(resolve('src/assets/icons'))
      .end();

    // 自定义 icon loader 用于加载 src/assets/icons 目录下的 svg
    config.module
      .rule('icon')
      .test(/\.svg$/)
      .include.add(resolve('src/assets/icons'))
      .end()
      .use('svg-sprite-loader')
      .loader('svg-sprite-loader')
      .options({
        symbolId: 'icon-[name]'
      });

    // 引入 jQuery
    config.plugins.push(
      new webpack.ProvidePlugin({
        $: 'jquery',
        jQuery: 'jquery',
        'windows.jQuery': 'jquery'
      })
    )
  }

};
