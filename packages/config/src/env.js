"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.validateAndGetConfig = validateAndGetConfig;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Attempt to load .env from workspace root if running locally
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../../.env') });
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
function validateAndGetConfig() {
    const config = {
        port: parseInt(process.env.PORT || '4000', 10),
        nodeEnv: process.env.NODE_ENV || 'development',
        googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'studioflow-ai-dev',
        googleCloudRegion: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
        googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
        googleCloudStorageBucket: process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'studioflow-ai-media-dev',
        geminiApiKey: process.env.GEMINI_API_KEY,
        geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        nextPublicApiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    };
    const warnings = [];
    if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
        warnings.push('GOOGLE_CLOUD_PROJECT_ID not set. Defaulting to studioflow-ai-dev.');
    }
    if (!process.env.GEMINI_API_KEY) {
        warnings.push('GEMINI_API_KEY not set. Root Agent will operate in demo fallback mode.');
    }
    if (warnings.length > 0 && config.nodeEnv !== 'test') {
        console.warn('⚠️ [StudioFlow Config Warning]:\n' + warnings.map(w => ` - ${w}`).join('\n'));
    }
    return config;
}
exports.env = validateAndGetConfig();
//# sourceMappingURL=env.js.map