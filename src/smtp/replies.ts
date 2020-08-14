type SMTPReply = [number, string];

// 2xx Success
export const BYE: SMTPReply = [221, 'Bye'];
export const AUTHENTICATION_SUCCESSFUL: SMTPReply = [
  235,
  'Authentication successful',
];
export const OK: SMTPReply = [250, 'Ok'];
export const TLS_GO_AHEAD: SMTPReply = [220, 'TLS go ahead'];

// 3xx Additional data required
export const START_MAIL_INPUT: SMTPReply = [
  354,
  'End data with <CR><LF>.<CR><LF>',
];

// 4xx Persistent transient failure
export const SERVER_SHUTTING_DOWN: SMTPReply = [
  421,
  'The server is shutting down',
];

// 5xx Permanent errors
export const SYNTAX_ERROR: SMTPReply = [500, 'Syntax error'];
export const SYNTAX_ERROR_ARGUMENT: SMTPReply = [
  501,
  'Syntax error in parameters or arguments',
];
export const NOT_IMPLEMENTED: SMTPReply = [502, 'Not implemented'];
export const BAD_SEQUENCE: SMTPReply = [503, 'Bad sequence of commands'];
export const NOT_IMPLEMENTED_ARGUMENT: SMTPReply = [
  504,
  'Command parameter is not implemented',
];
export const BAD_USERNAME_OR_PASSWORD: SMTPReply = [
  535,
  'Bad username or password',
];
export const MAXIMUM_SIZE_EXCEEDED: SMTPReply = [552, 'Maximum size exceeded'];
