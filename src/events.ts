import { microMTA } from './';
import { microMTAMessage } from './message';

export type microMTAMessageEventListener = (
  this: microMTA,
  message: microMTAMessage
) => void;
export type microMTARejectedEventListener = (
  this: microMTA,
  sender: string,
  recipients: string[]
) => void;
export type microMTAErrorEventListener = (this: microMTA, error: Error) => void;

export interface microMTAEvents {
  message: Set<microMTAMessageEventListener>;
  error: Set<microMTAErrorEventListener>;
  rejected: Set<microMTARejectedEventListener>;
}
