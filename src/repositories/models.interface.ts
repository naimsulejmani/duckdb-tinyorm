// Types for DuckDB secrets
export enum SecretType {
    S3 = 's3',
    AZURE = 'azure',
    GCS = 'gcs',
    MYSQL = 'mysql',
    POSTGRES = 'postgres',
    SQLITE = 'sqlite',
    CUSTOM = 'custom'
}

export enum AzureProviderType {
    CREDENTIAL_CHAIN = 'credential_chain',
    CONFIG = 'config',
    CONNECTION_STRING = 'connection_string'
}

// Base interface for all secrets
export interface BaseSecret {
    name: string;
    type: SecretType;
}

// S3 Secret interface
export interface S3Secret extends BaseSecret {
    type: SecretType.S3;
    keyId: string;
    secret: string;
    region?: string;
    scope?: string;
}

// Azure Secret interface with different provider options
export interface AzureSecretBase extends BaseSecret {
    type: SecretType.AZURE;
}

export interface AzureCredentialChainSecret extends AzureSecretBase {
    provider: AzureProviderType.CREDENTIAL_CHAIN;
    chain: string;
    accountName: string;
}

export interface AzureConfigSecret extends AzureSecretBase {
    provider: AzureProviderType.CONFIG;
    accountName: string;
}

export interface AzureConnectionStringSecret extends AzureSecretBase {
    provider?: undefined;
    connectionString: string;
}

// Combined type for Azure secrets
export type AzureSecret = AzureCredentialChainSecret | AzureConfigSecret | AzureConnectionStringSecret;

// Union type for all supported secrets
export type Secret = S3Secret | AzureSecret;