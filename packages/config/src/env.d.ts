export interface AppConfig {
    port: number;
    nodeEnv: string;
    googleCloudProjectId: string;
    googleCloudRegion: string;
    googleApplicationCredentials?: string;
    firestoreDatabaseId: string;
    googleCloudStorageBucket: string;
    geminiApiKey?: string;
    geminiModel: string;
    nextPublicApiUrl: string;
}
export declare function validateAndGetConfig(): AppConfig;
export declare const env: AppConfig;
//# sourceMappingURL=env.d.ts.map