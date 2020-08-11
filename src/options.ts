import { SecureContextOptions } from 'tls';

import { microMTAConnection } from './connection';

export interface microMTAOptions {
  hostname?: string;
  port?: number;
  tlsPort?: number;
  ip?: string;
  size?: number;
  authenticate?: (
    connection: microMTAConnection,
    username: string,
    password: string
  ) => boolean | Promise<boolean>;
  secureContextOptions?: SecureContextOptions;
}
