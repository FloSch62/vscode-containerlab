const path = require('path');

module.exports = {
  mode: 'production', // or 'development' for debugging
  target: 'web',
  entry: './src/topoViewerTs/webview-ui/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'topoViewerEngine.js',
    libraryTarget: 'module'
  },
  experiments: {
    outputModule: true
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'src/topoViewerTs/tsconfig.json'),
            transpileOnly: true
          }
        },
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@topoViewerTs': path.resolve(__dirname, 'src/topoViewerTs')
    }
  },
  externals: {
    'vscode': 'commonjs vscode',
    '../backend/logger': 'commonjs ../backend/logger',
    '../../backend/logger': 'commonjs ../../backend/logger',
    '../../../backend/logger': 'commonjs ../../../backend/logger'
  },
  // Disable asset size warnings
  performance: {
    hints: false
  }
};