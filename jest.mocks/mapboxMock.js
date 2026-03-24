module.exports = {
  setAccessToken: jest.fn(),
  MapView: jest.fn(({ children }) => children),
  Camera: jest.fn(({ children }) => children),
  UserLocation: jest.fn(() => null),
  PointAnnotation: jest.fn(({ children }) => children),
  ShapeSource: jest.fn(({ children }) => children),
  LineLayer: jest.fn(() => null),
};
