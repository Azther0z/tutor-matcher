export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  forceExit: true,
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/generated/"],
  modulePathIgnorePatterns: ["/dist/", "/generated/"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
};
