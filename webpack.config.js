const path = require('path');

module.exports = {
  mode: 'production', // or 'development' for debugging
  target: 'web',
  entry: './src/topoViewer/webview-ui/index.ts',
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
            options: { transpileOnly: true }
          },
          exclude: /node_modules/
        }
      ]
    },
  resolve: {
    extensions: ['.ts', '.js']
  },
  // Disable asset size warnings to keep the build output clean. The
  // bundled webview code is quite large but the size is acceptable for the
  // extension, so we suppress webpack's performance hints.
  performance: {
    hints: false
  }
};