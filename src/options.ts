import { SecureContextOptions } from 'tls';

export interface microMTAOptions {
  hostname?: string;
  port?: number;
  tlsPort?: number;
  ip?: string;
  size?: number;
  enableAuth?: string;
  secureContextOptions?: SecureContextOptions;
}
