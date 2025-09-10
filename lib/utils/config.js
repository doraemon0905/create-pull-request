"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.getConfig = getConfig;
exports.getConfigValue = getConfigValue;
exports.validateConfig = validateConfig;
exports.getConfigFilePath = getConfigFilePath;
exports.hasJsonConfig = hasJsonConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const CONFIG_FILE = path.join(os.homedir(), '.create-pr', 'env-config.json');
/**
 * Load configuration from JSON file
 */
function loadConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
        throw new Error(`Configuration file not found at ${CONFIG_FILE}. Please run 'create-pr setup' to create your configuration.`);
    }
    try {
        const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
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
function getConfig(section) {
    const config = loadConfig();
    return config[section];
}
/**
 * Get specific configuration value
 */
function getConfigValue(section, key) {
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
function validateConfig() {
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
    catch {
        return false;
    }
}
/**
 * Get configuration file path
 */
function getConfigFilePath() {
    return CONFIG_FILE;
}
/**
 * Check if JSON config file exists
 */
function hasJsonConfig() {
    return fs.existsSync(CONFIG_FILE);
}
//# sourceMappingURL=config.js.map