// Registers ts-node with the test tsconfig (cross-platform; no env vars needed).
require('ts-node').register({
    project: require('path').join(__dirname, '..', 'tsconfig.test.json'),
});
