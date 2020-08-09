export interface microMTAOptions {
  hostname?: string;
  port?: number;
  tlsPort?: number;
  ip?: string;
  size?: number;
  tls?: {
    key: string;
    cert: string;
  };
}
