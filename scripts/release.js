const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

console.log(`Current version: ${currentVersion}`);

// Parse version components
const versionParts = currentVersion.split('.').map(Number);
const [major, minor, patch] = versionParts;

// Setup readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\nSelect version increment type:');
console.log('1) Patch (x.x.X) - for bug fixes');
console.log('2) Minor (x.X.0) - for new features');
console.log('3) Major (X.0.0) - for breaking changes');
console.log('4) Custom version');

rl.question('\nEnter your choice (1-4): ', async (choice) => {
    let newVersion;

    switch (choice) {
        case '1':
            newVersion = `${major}.${minor}.${patch + 1}`;
            break;
        case '2':
            newVersion = `${major}.${minor + 1}.0`;
            break;
        case '3':
            newVersion = `${major + 1}.0.0`;
            break;
        case '4':
            await new Promise(resolve => {
                rl.question('Enter custom version (x.y.z): ', (customVersion) => {
                    if (/^\d+\.\d+\.\d+$/.test(customVersion)) {
                        newVersion = customVersion;
                        resolve();
                    } else {
                        console.log('Invalid version format. Please use x.y.z format with numbers only.');
                        process.exit(1);
                    }
                });
            });
            break;
        default:
            console.log('Invalid choice. Exiting.');
            rl.close();
            process.exit(1);
  }

    rl.close();

    console.log(`\nUpdating version from ${currentVersion} to ${newVersion}`);

    // Update package.json with new version
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

    // Create tag name with v prefix
    const tagName = `v${newVersion}`;

    try {
        // Make sure everything is committed before we create the version commit
        const status = execSync('git status --porcelain').toString().trim();
        if (status) {
        console.log('Committing changes to package.json...');
        execSync('git add package.json', { stdio: 'inherit' });
        execSync(`git commit -m "chore: bump version to ${newVersion}"`, { stdio: 'inherit' });
    }

      // Create and push the tag
      console.log(`Creating new tag: ${tagName}`);
      execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, { stdio: 'inherit' });
      console.log(`Tag ${tagName} created locally. Pushing to remote...`);

      execSync('git push', { stdio: 'inherit' });
      execSync('git push origin --tags', { stdio: 'inherit' });
      console.log(`\nVersion ${newVersion} released successfully!`);
      console.log('Tag pushed to remote. GitHub Actions workflow should start automatically.');
      console.log('Check the Actions tab in GitHub to monitor progress.');

  } catch (error) {
      console.error('Error during release process:', error.message);
      process.exit(1);
  }
});
