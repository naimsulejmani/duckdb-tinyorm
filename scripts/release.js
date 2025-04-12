const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read the current version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

console.log(`Current version: ${currentVersion}`);

// Create tag name with v prefix
const tagName = `v${currentVersion}`;

try {
  // Check if tag already exists
  try {
    execSync(`git rev-parse ${tagName}`, { stdio: 'ignore' });
    console.log(`Tag ${tagName} already exists! Please update version in package.json first.`);
    process.exit(1);
  } catch (e) {
    // Tag doesn't exist, we can continue
    console.log(`Creating new tag: ${tagName}`);
  }

  // Make sure everything is committed
  const status = execSync('git status --porcelain').toString().trim();
  if (status) {
    console.log('You have uncommitted changes. Please commit them before creating a tag.');
    console.log(status);
    process.exit(1);
  }

  // Create and push the tag
  execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, { stdio: 'inherit' });
  console.log(`Tag ${tagName} created locally. Pushing to remote...`);
  
  execSync('git push origin --tags', { stdio: 'inherit' });
  console.log(`Tag ${tagName} pushed to remote.`);
  console.log('GitHub Actions workflow should start automatically.');
  console.log('Check the Actions tab in GitHub to monitor progress.');

} catch (error) {
  console.error('Error creating or pushing tag:', error.message);
  process.exit(1);
}
