module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // worklets-core plugin must be before reanimated
      'react-native-worklets-core/plugin',
      // reanimated plugin must be last
      'react-native-reanimated/plugin',
    ],
  };
};
