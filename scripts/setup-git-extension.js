#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const chalk = require('chalk');

// Configuration constants
const CONFIG_DIRECTORY_NAME = CONFIG_DIRECTORY_NAME;
const EXECUTABLE_PERMISSIONS = EXECUTABLE_PERMISSIONS;

/**
 * Set up git extension to enable 'git create-pr' command
 */
function setupGitExtension() {
    console.log(chalk.blue('🔧 Setting up git extension for "git create-pr" command...'));
    
    try {
        // Get the directory where this project is located
        const projectDir = path.resolve(__dirname, '..');
        const gitExtensionPath = path.join(projectDir, 'git-create-pr');
        
        // Create git extension script if it doesn't exist
        if (!fs.existsSync(gitExtensionPath)) {
            const gitExtensionContent = `#!/usr/bin/env node

// Git extension wrapper for create-pr
// This allows using 'git create-pr' instead of just 'create-pr'

const { spawn } = require('child_process');
const path = require('path');

// Get the directory where this script is located
const scriptDir = __dirname;
const createPrScript = path.join(scriptDir, 'bin', 'create-pr');

// Forward all arguments to the original create-pr script
const args = process.argv.slice(2);

// Spawn the create-pr command with all arguments
const child = spawn('node', [createPrScript, ...args], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

// Handle process events
child.on('close', (code) => {
  process.exit(code || 0);
});

child.on('error', (error) => {
  console.error('Error running create-pr:', error.message);
  process.exit(1);
});
`;
            
            fs.writeFileSync(gitExtensionPath, gitExtensionContent);
            console.log(chalk.green('✅ Created git-create-pr extension script'));
        } else {
            console.log(chalk.gray('ℹ️  git-create-pr extension script already exists'));
        }
        
        // Make the script executable on Unix-like systems
        if (process.platform !== 'win32') {
            fs.chmodSync(gitExtensionPath, EXECUTABLE_PERMISSIONS);
            console.log(chalk.green('✅ Made git extension script executable'));
        }
        
        // Check if git extension is already in PATH
        const isInPath = checkGitExtensionInPath(projectDir);
        
        if (!isInPath) {
            console.log(chalk.yellow('⚠️  Git extension needs to be added to PATH'));
            addGitExtensionToPath(projectDir);
        } else {
            console.log(chalk.green('✅ Git extension is accessible via PATH'));
        }
        
        return true;
        
    } catch (error) {
        console.error(chalk.red('❌ Error setting up git extension:'), error.message);
        return false;
    }
}

/**
 * Check if git extension is accessible via PATH
 */
function checkGitExtensionInPath(projectDir) {
    return new Promise((resolve) => {
        const testCommand = process.platform === 'win32' ? 'where' : 'which';
        const child = spawn(testCommand, ['git-create-pr'], {
            stdio: 'pipe',
            shell: true
        });
        
        child.on('close', (code) => {
            resolve(code === 0);
        });
        
        child.on('error', () => {
            resolve(false);
        });
    });
}

/**
 * Add git extension to PATH
 */
function addGitExtensionToPath(projectDir) {
    console.log(chalk.blue('🔧 Setting up PATH configuration for git extension...'));
    
    const homeDir = os.homedir();
    const createPrDir = path.join(homeDir, CONFIG_DIRECTORY_NAME);
    
    // Create .create-pr directory if it doesn't exist
    if (!fs.existsSync(createPrDir)) {
        fs.mkdirSync(createPrDir, { recursive: true });
    }
    
    // Create or update PATH configuration file
    const pathConfigFile = path.join(createPrDir, 'path-config.json');
    const pathConfig = {
        projectPath: projectDir,
        addedAt: new Date().toISOString(),
        instructions: {
            manual: `Add this directory to your PATH: ${projectDir}`,
            shellConfig: getShellConfigInstructions(projectDir)
        }
    };
    
    fs.writeFileSync(pathConfigFile, JSON.stringify(pathConfig, null, 2));
    
    // Provide instructions based on the shell and platform
    console.log(chalk.yellow('\n📋 To use "git create-pr" command, add the project directory to your PATH:'));
    console.log(chalk.gray(`   Project directory: ${projectDir}\n`));
    
    if (process.platform === 'win32') {
        console.log(chalk.blue('Windows Instructions:'));
        console.log('1. Open System Properties → Advanced → Environment Variables');
        console.log('2. Edit the PATH variable and add:');
        console.log(chalk.yellow(`   ${projectDir}`));
        console.log('3. Restart your terminal\n');
    } else {
        const shell = process.env.SHELL || '/bin/bash';
        const shellName = path.basename(shell);
        
        console.log(chalk.blue(`${shellName} Instructions:`));
        console.log('Add this line to your shell configuration file:');
        
        let configFile;
        let exportLine;
        
        switch (shellName) {
            case 'zsh':
                configFile = '~/.zshrc';
                break;
            case 'bash':
                configFile = '~/.bashrc or ~/.bash_profile';
                break;
            case 'fish':
                configFile = '~/.config/fish/config.fish';
                exportLine = `set -gx PATH ${projectDir} $PATH`;
                break;
            default:
                configFile = 'your shell configuration file';
        }
        
        if (!exportLine) {
            exportLine = `export PATH="${projectDir}:$PATH"`;
        }
        
        console.log(chalk.yellow(`   # Add to ${configFile}`));
        console.log(chalk.yellow(`   ${exportLine}`));
        console.log('\nThen reload your shell:');
        console.log(chalk.gray(`   source ${configFile.replace('~/', homeDir + '/')}`));
        console.log(chalk.gray('   # OR restart your terminal\n'));
    }
    
    console.log(chalk.blue('Alternative: Global Installation'));
    console.log('You can also install this tool globally using npm:');
    console.log(chalk.yellow('   npm install -g publish-pull-request'));
    console.log(chalk.gray('   # This will make both "create-pr" and "git create-pr" available globally\n'));
}

/**
 * Get shell-specific configuration instructions
 */
function getShellConfigInstructions(projectDir) {
    const instructions = {};
    
    instructions.bash = {
        file: '~/.bashrc or ~/.bash_profile',
        command: `export PATH="${projectDir}:$PATH"`
    };
    
    instructions.zsh = {
        file: '~/.zshrc',
        command: `export PATH="${projectDir}:$PATH"`
    };
    
    instructions.fish = {
        file: '~/.config/fish/config.fish',
        command: `set -gx PATH ${projectDir} $PATH`
    };
    
    return instructions;
}

/**
 * Test git extension functionality
 */
async function testGitExtension() {
    console.log(chalk.blue('🧪 Testing git extension...'));
    
    return new Promise((resolve) => {
        const child = spawn('git', ['create-pr', '--help'], {
            stdio: 'pipe',
            shell: true
        });
        
        let output = '';
        child.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            output += data.toString();
        });
        
        child.on('close', (code) => {
            if (code === 0 && output.includes('create-pr')) {
                console.log(chalk.green('✅ Git extension is working correctly!'));
                resolve(true);
            } else {
                console.log(chalk.yellow('⚠️  Git extension test failed. You may need to restart your terminal or update your PATH.'));
                resolve(false);
            }
        });
        
        child.on('error', (error) => {
            console.log(chalk.yellow('⚠️  Could not test git extension. PATH may need to be updated manually.'));
            resolve(false);
        });
    });
}

/**
 * Remove git extension setup
 */
function removeGitExtension() {
    console.log(chalk.blue('🗑️  Removing git extension setup...'));
    
    try {
        const projectDir = path.resolve(__dirname, '..');
        const gitExtensionPath = path.join(projectDir, 'git-create-pr');
        
        if (fs.existsSync(gitExtensionPath)) {
            fs.unlinkSync(gitExtensionPath);
            console.log(chalk.green('✅ Removed git-create-pr extension script'));
        }
        
        const homeDir = os.homedir();
        const createPrDir = path.join(homeDir, CONFIG_DIRECTORY_NAME);
        const pathConfigFile = path.join(createPrDir, 'path-config.json');
        
        if (fs.existsSync(pathConfigFile)) {
            fs.unlinkSync(pathConfigFile);
            console.log(chalk.green('✅ Removed PATH configuration file'));
        }
        
        console.log(chalk.yellow('⚠️  You may need to manually remove the project path from your shell configuration'));
        
        return true;
    } catch (error) {
        console.error(chalk.red('❌ Error removing git extension:'), error.message);
        return false;
    }
}

module.exports = {
    setupGitExtension,
    testGitExtension,
    removeGitExtension,
    checkGitExtensionInPath,
    addGitExtensionToPath
};

// Run setup if called directly
if (require.main === module) {
    setupGitExtension();
}