// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Add resolver configuration for react-native-vision-camera
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Optimize bundle for worklets and vision camera
config.transformer = {
  ...config.transformer,
  // Disable inline requires for worklets compatibility
  inlineRequires: false,
  minifierConfig: {
    mangle: {
      keep_fnames: true,
    },
  },
};

// Enable detailed logging for debugging
config.reporter = {
  update: (event) => {
    if (event.type === 'dep_graph_loading') {
      console.log('[Metro] Loading dependency graph...');
    } else if (event.type === 'transform_cache_reset') {
      console.log('[Metro] Transform cache reset');
    } else if (event.type === 'bundle_build_started') {
      console.log(`[Metro] Bundle build started for ${event.bundleDetails.platform}`);
    } else if (event.type === 'bundle_build_done') {
      console.log(`[Metro] Bundle build done`);
    } else if (event.type === 'bundling_error') {
      console.error('[Metro] Bundling error:', event.error);
    }
  },
};

// Ensure metro can resolve all node modules properly
config.resolver.nodeModulesPaths = [
  require('path').resolve(__dirname, 'node_modules'),
];

// Add detailed resolver configuration
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.resolverPlatforms = ['ios', 'android', 'native', 'web'];

module.exports = withNativeWind(config, { input: './global.css' });