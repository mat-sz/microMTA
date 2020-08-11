export enum SMTPCommand {
  HELO = 'HELO',
  EHLO = 'EHLO',
  MAIL = 'MAIL',
  RCPT = 'RCPT',
  DATA = 'DATA',
  AUTH = 'AUTH',
  NOOP = 'NOOP',
  RSET = 'RSET',
  QUIT = 'QUIT',
  STARTTLS = 'STARTTLS',
}
