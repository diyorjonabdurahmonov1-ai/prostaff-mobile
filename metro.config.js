const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .mjs to resolver extensions so Metro can resolve lucide-react-native icons
config.resolver.sourceExts.push('mjs');

module.exports = config;
