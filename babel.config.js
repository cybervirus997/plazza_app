module.exports = function (api) {
  const testing = api.env('test');
  return {
    presets: ['babel-preset-expo'],
    // Jest runs CommonJS; Metro keeps control of dynamic imports in the app.
    plugins: testing ? ['@babel/plugin-transform-dynamic-import'] : [],
  };
};
