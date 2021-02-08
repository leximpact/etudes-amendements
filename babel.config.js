module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        corejs: 3,
        useBuiltIns: "usage",
      },
    ],
    "@babel/preset-typescript",
  ],
  plugins: [
    // "@babel/plugin-proposal-class-properties",
    // "@babel/plugin-syntax-dynamic-import",
  ],
}
