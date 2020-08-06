export interface microMTAOptions {
  hostname?: string;
  port?: number;
  ip?: string;
  size?: number;
  tls?: {
    key: string;
    cert: string;
  };
}
