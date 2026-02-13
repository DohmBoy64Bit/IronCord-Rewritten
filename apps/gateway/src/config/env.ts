const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'] as const;

export interface Config {
  port: number;
  jwtSecret: string;
  databaseUrl: string;
  ircHost: string;
  ircPort: number;
  nodeEnv: string;
  clientOrigin: string;
}

function validateEnv(): void {
  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

export function loadConfig(): Config {
  if (process.env.NODE_ENV === 'production') {
    validateEnv();
  }

  const jwtSecret = process.env.JWT_SECRET || 'ironcord_secret_key_change_me';
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://ironcord:ironcord@localhost:5432/ironcord';

  // Security: Prevent production deployment with default secrets
  if (process.env.NODE_ENV === 'production') {
    const insecureDefaults = [
      'ironcord_secret_key_change_me',
      'ironcord_secret_key_change_me_in_production',
      'your-secure-jwt-secret-here-min-32-chars',
    ];
    
    if (insecureDefaults.includes(jwtSecret)) {
      throw new Error(
        'SECURITY ERROR: Cannot use default JWT_SECRET in production. ' +
        'Set a secure JWT_SECRET environment variable.'
      );
    }

    if (databaseUrl.includes('ironcord:ironcord@') || 
        databaseUrl.includes('your-secure-db-password')) {
      throw new Error(
        'SECURITY ERROR: Cannot use default database credentials in production. ' +
        'Set a secure DATABASE_URL environment variable.'
      );
    }
  }

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    jwtSecret,
    databaseUrl,
    ircHost: process.env.IRC_HOST || 'localhost',
    ircPort: parseInt(process.env.IRC_PORT || '6667', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    clientOrigin: process.env.CLIENT_ORIGIN || '*',
  };
}

export const config = loadConfig();
