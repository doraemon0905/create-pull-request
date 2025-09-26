import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CONFIG } from '../constants/index.js';
/**
 * Get the configuration file path
 * @returns The full path to the configuration file
 */
export function getConfigFilePath() {
    return path.join(os.homedir(), CONFIG.DIRECTORY_NAME, CONFIG.FILE_NAME);
}
/**
 * Load configuration from JSON file
 */
export function loadConfig() {
    const configFile = getConfigFilePath();
    if (!fs.existsSync(configFile)) {
        throw new Error(`Configuration file not found at ${configFile}. Please run 'create-pr setup' to create your configuration.`);
    }
    try {
        const configData = fs.readFileSync(configFile, 'utf8');
        const config = JSON.parse(configData);
        return config;
    }
    catch (error) {
        throw new Error(`Failed to parse configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Get specific configuration section
 */
export function getConfig(section) {
    const config = loadConfig();
    return config[section];
}
/**
 * Get specific configuration value
 */
export function getConfigValue(section, key) {
    const config = loadConfig();
    const sectionConfig = config[section];
    if (sectionConfig && typeof sectionConfig === 'object') {
        return sectionConfig[key];
    }
    throw new Error(`Configuration section '${String(section)}' not found or invalid`);
}
/**
 * Check if configuration exists and is valid
 */
export function validateConfig() {
    try {
        const config = loadConfig();
        // Check required fields
        const required = [
            config.jira.baseUrl,
            config.jira.username,
            config.jira.apiToken,
            config.github.token
        ];
        return required.every(field => field && field.trim().length > 0);
    }
    catch (_error) {
        return false;
    }
}
/**
 * Check if JSON config file exists
 */
export function hasJsonConfig() {
    return fs.existsSync(getConfigFilePath());
}
//# sourceMappingURL=config.js.map