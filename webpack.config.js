
// webpack.config.js
module.exports = {
    // ... остальные настройки
  
    externals: {
      jStat: './public/jstat.min.js',
    },
    resolve: {
      alias: {
        three: 'three/esm/three.min.js',
      },
    },
    // ... остальные настройки
  };
  