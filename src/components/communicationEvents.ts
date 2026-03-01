export type CommunicationSummaryEventDetail = {
  unreadMessages: number;
  messageRequests: number;
  friendRequests: number;
  totalAttention: number;
  newSinceLastOpen: number;
};

export type CommunicationOpenThreadEventDetail = {
  targetUsername: string;
};

export type CommunicationSendPayloadEventDetail = {
  targetUsername: string;
  body?: string;
  payload?: Record<string, unknown> | null;
};

export const COMMUNICATION_OPEN_EVENT = 'tld:communication:open';
export const COMMUNICATION_SUMMARY_EVENT = 'tld:communication:summary';
export const COMMUNICATION_OPEN_THREAD_EVENT = 'tld:communication:open-thread';
export const COMMUNICATION_SEND_PAYLOAD_EVENT = 'tld:communication:send-payload';

export const openCommunicationHub = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(COMMUNICATION_OPEN_EVENT));
};

export const openCommunicationThreadByUsername = (targetUsername: string): void => {
  const normalized = String(targetUsername ?? '').trim();
  if (!normalized || typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<CommunicationOpenThreadEventDetail>(COMMUNICATION_OPEN_THREAD_EVENT, {
      detail: { targetUsername: normalized },
    }),
  );
};

export const sendCommunicationPayloadToUsername = (
  targetUsername: string,
  payload: {
    body?: string;
    payload?: Record<string, unknown> | null;
  },
): void => {
  const normalized = String(targetUsername ?? '').trim();
  if (!normalized || typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<CommunicationSendPayloadEventDetail>(COMMUNICATION_SEND_PAYLOAD_EVENT, {
      detail: {
        targetUsername: normalized,
        body: String(payload.body ?? ''),
        payload: payload.payload ?? null,
      },
    }),
  );
};
