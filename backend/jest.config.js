module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  clearMocks: true,
  // sanitize-html 2.17+ arrastra htmlparser2/domhandler/domutils/... que son
  // ESM-only ("type": "module"). Node moderno los puede require() en
  // runtime, pero el loader de Jest no — hay que transformarlos. Se lista la
  // cadena exacta para no transformar TODO node_modules (lento y frágil).
  transformIgnorePatterns: [
    "/node_modules/(?!(htmlparser2|domelementtype|domhandler|domutils|dom-serializer|entities)/)",
  ],
};
