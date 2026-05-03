// Jest setup file for React Native testing

// Mock global variables
global.__DEV__ = true;

// Provide React globally for react-test-renderer
global.React = require('react');

// Mock React Native
jest.mock('react-native', () => {
  const RN = {
    Platform: {
      OS: 'ios',
      select: jest.fn(obj => obj.ios || obj.default),
    },
    StyleSheet: {
      create: jest.fn(styles => styles),
      flatten: jest.fn(style => style),
    },
    View: 'View',
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    ScrollView: 'ScrollView',
    ActivityIndicator: 'ActivityIndicator',
    Switch: 'Switch',
    Alert: {
      alert: jest.fn(),
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 667 })),
    },
  };
  return RN;
});

// Mock Expo Vector Icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: props => React.createElement('Ionicons', props),
    MaterialIcons: props => React.createElement('MaterialIcons', props),
    FontAwesome: props => React.createElement('FontAwesome', props),
  };
});

// Mock Expo Image
jest.mock('expo-image', () => {
  const React = require('react');
  return {
    Image: props => React.createElement('Image', props),
  };
});

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children, ...props }) => React.createElement('Svg', props, children),
    Svg: ({ children, ...props }) => React.createElement('Svg', props, children),
    Line: props => React.createElement('Line', props),
    Circle: props => React.createElement('Circle', props),
    Polyline: props => React.createElement('Polyline', props),
    Text: ({ children, ...props }) => React.createElement('SvgText', props, children),
    G: ({ children, ...props }) => React.createElement('G', props, children),
    Path: props => React.createElement('Path', props),
    Rect: props => React.createElement('Rect', props),
    Defs: ({ children, ...props }) => React.createElement('Defs', props, children),
    LinearGradient: ({ children, ...props }) => React.createElement('LinearGradient', props, children),
    Stop: props => React.createElement('Stop', props),
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
  clear: jest.fn(),
}));

// Mock FileSystem
jest.mock('expo-file-system', () => ({
  DocumentDirectory: '/mock/documents/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
