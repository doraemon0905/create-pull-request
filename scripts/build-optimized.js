#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIB_DIR = path.join(__dirname, '..', 'lib');
const SRC_DIR = path.join(__dirname, '..', 'src');
const TSBUILDINFO_FILE = path.join(LIB_DIR, 'tsconfig.tsbuildinfo');

/**
 * Optimized build script that leverages TypeScript incremental compilation
 * and smart cache invalidation for faster CI/CD builds
 */
async function optimizedBuild() {
  console.log(chalk.blue('🏗️  Starting optimized build process...\n'));

  try {
    // Check if this is an incremental build
    const isIncremental = fs.existsSync(TSBUILDINFO_FILE);
    
    if (isIncremental) {
      console.log(chalk.green('✅ Found build cache - performing incremental build'));
      
      // Check if source files are newer than build info
      const buildInfoStats = fs.statSync(TSBUILDINFO_FILE);
      const needsRebuild = await checkIfRebuildNeeded(buildInfoStats.mtime);
      
      if (!needsRebuild) {
        console.log(chalk.gray('ℹ️  No source changes detected - skipping build'));
        await validateExistingBuild();
        return;
      }
    } else {
      console.log(chalk.yellow('🔄 No build cache found - performing full build'));
    }

    // Ensure lib directory exists
    if (!fs.existsSync(LIB_DIR)) {
      fs.mkdirSync(LIB_DIR, { recursive: true });
    }

    // Run TypeScript compilation
    console.log(chalk.blue('📝 Compiling TypeScript...'));
    const startTime = Date.now();
    
    try {
      execSync('npx tsc', { 
        stdio: 'pipe',
        encoding: 'utf8' 
      });
    } catch (error) {
      console.error(chalk.red('❌ TypeScript compilation failed:'));
      console.error(error.stdout || error.message);
      process.exit(1);
    }

    const buildTime = Date.now() - startTime;
    console.log(chalk.green(`✅ TypeScript compilation completed in ${buildTime}ms`));

    // Validate build output
    await validateBuildOutput();

    // Generate build summary
    await generateBuildSummary(isIncremental, buildTime);

    console.log(chalk.green('\n🎉 Optimized build completed successfully!'));

  } catch (error) {
    console.error(chalk.red('\n❌ Build failed:'), error.message);
    process.exit(1);
  }
}

/**
 * Check if source files have been modified since last build
 */
async function checkIfRebuildNeeded(buildInfoMtime) {
  const sourceFiles = getAllSourceFiles(SRC_DIR);
  
  for (const file of sourceFiles) {
    const stats = fs.statSync(file);
    if (stats.mtime > buildInfoMtime) {
      console.log(chalk.yellow(`🔄 Source change detected: ${path.relative(process.cwd(), file)}`));
      return true;
    }
  }
  
  // Also check tsconfig.json
  const tsconfigPath = path.join(__dirname, '..', 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    const tsconfigStats = fs.statSync(tsconfigPath);
    if (tsconfigStats.mtime > buildInfoMtime) {
      console.log(chalk.yellow('🔄 TypeScript config changed'));
      return true;
    }
  }
  
  return false;
}

/**
 * Get all TypeScript source files recursively
 */
function getAllSourceFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory() && item !== 'node_modules' && item !== 'lib') {
      files.push(...getAllSourceFiles(fullPath));
    } else if (item.endsWith('.ts') && !item.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Validate that existing build output is still valid
 */
async function validateExistingBuild() {
  const requiredFiles = [
    path.join(LIB_DIR, 'index.js'),
    path.join(LIB_DIR, 'index.d.ts'),
  ];
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Required build artifact missing: ${path.relative(process.cwd(), file)}`);
    }
  }
  
  console.log(chalk.green('✅ Existing build artifacts validated'));
}

/**
 * Validate that build produced expected output
 */
async function validateBuildOutput() {
  console.log(chalk.blue('🔍 Validating build output...'));
  
  const requiredFiles = [
    path.join(LIB_DIR, 'index.js'),
    path.join(LIB_DIR, 'index.d.ts'),
  ];
  
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
  
  if (missingFiles.length > 0) {
    throw new Error(`Missing build artifacts: ${missingFiles.map(f => path.relative(process.cwd(), f)).join(', ')}`);
  }
  
  // Count generated files
  const generatedFiles = getAllGeneratedFiles(LIB_DIR);
  console.log(chalk.green(`✅ Build validation passed - generated ${generatedFiles.length} files`));
}

/**
 * Get all generated files in lib directory
 */
function getAllGeneratedFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory()) {
      files.push(...getAllGeneratedFiles(fullPath));
    } else if (!item.endsWith('.tsbuildinfo')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Generate build summary with statistics
 */
async function generateBuildSummary(wasIncremental, buildTime) {
  const sourceFiles = getAllSourceFiles(SRC_DIR);
  const generatedFiles = getAllGeneratedFiles(LIB_DIR);
  
  // Calculate sizes
  const sourceSize = sourceFiles.reduce((total, file) => {
    return total + fs.statSync(file).size;
  }, 0);
  
  const generatedSize = generatedFiles.reduce((total, file) => {
    return total + fs.statSync(file).size;
  }, 0);
  
  console.log(chalk.blue('\n📊 Build Summary:'));
  console.log(`   Build Type: ${wasIncremental ? chalk.green('Incremental') : chalk.yellow('Full')}`);
  console.log(`   Build Time: ${chalk.cyan(buildTime + 'ms')}`);
  console.log(`   Source Files: ${chalk.cyan(sourceFiles.length)} (${formatBytes(sourceSize)})`);
  console.log(`   Generated Files: ${chalk.cyan(generatedFiles.length)} (${formatBytes(generatedSize)})`);
  console.log(`   Compression Ratio: ${chalk.cyan((generatedSize / sourceSize * 100).toFixed(1) + '%')}`);
  
  // Save build info for CI
  if (process.env.CI) {
    const buildInfo = {
      timestamp: new Date().toISOString(),
      buildType: wasIncremental ? 'incremental' : 'full',
      buildTime,
      sourceFiles: sourceFiles.length,
      generatedFiles: generatedFiles.length,
      sourceSize,
      generatedSize
    };
    
    fs.writeFileSync(path.join(LIB_DIR, 'build-info.json'), JSON.stringify(buildInfo, null, 2));
  }
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the build if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  optimizedBuild();
}

export { optimizedBuild };
