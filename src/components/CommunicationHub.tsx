import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  archiveCommunicationThreadRequest,
  blockCommunicationPlayer,
  deleteCommunicationMessageRequest,
  fetchCommunicationInbox,
  fetchCommunicationSummary,
  fetchCommunicationTokenSuggestions,
  openCommunicationThreadRequest,
  removeCommunicationFriend,
  respondCommunicationFriendRequest,
  sendCommunicationFriendRequest,
  sendCommunicationMessageRequest,
  setCommunicationUiStateRequest,
  unblockCommunicationPlayer,
  type CommunicationFriend,
  type CommunicationInboxResponse,
  type CommunicationMessage,
  type CommunicationMessagePayload,
  type CommunicationSummary,
  type CommunicationThreadSummary,
  type CommunicationTokenSuggestion,
} from '../api/gameApi';
import { getSession } from '../auth';
import {
  COMMUNICATION_OPEN_EVENT,
  COMMUNICATION_OPEN_THREAD_EVENT,
  COMMUNICATION_SEND_PAYLOAD_EVENT,
  COMMUNICATION_SUMMARY_EVENT,
  type CommunicationOpenThreadEventDetail,
  type CommunicationSendPayloadEventDetail,
  type CommunicationSummaryEventDetail,
} from './communicationEvents';

const POLL_MS = 12000;
const SUMMARY_POLL_MS = 25000;
const UI_STATE_SAVE_DEBOUNCE_MS = 500;
const MAX_BODY_LENGTH = 800;
const MAX_MESSAGES = 70;
const MOBILE_BREAKPOINT = 920;
const UI_STATE_VERSION = 2;
const TOKEN_CLICK_EVENT = 'tld:communication:token-click';
const MESSAGE_TOKEN_REGEX = /(\/\/Ozn[aá]men[ií]:\d+|@[^\s]+|#[^\s]+|_\d{1,4}\|\d{1,4}_)/gu;
const QUICK_EMOJIS = ['🙂', '😄', '🔥', '⚔️', '🛡️'];
const EMOJI_TOKEN_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /:\)/g, replacement: '🙂' },
  { pattern: /:D/gi, replacement: '😄' },
  { pattern: /\bFIRE\b/gi, replacement: '🔥' },
  { pattern: /\bFIGHT\b/gi, replacement: '⚔️' },
  { pattern: /\bSHIELD\b/gi, replacement: '🛡️' },
];
const TABS = ['threads', 'requests', 'friends', 'blocked'] as const;

type HubTab = (typeof TABS)[number];
type AutocompleteTokenType = 'user' | 'kingdom' | 'village';

type HubUiState = {
  version: number;
  hubOpen: boolean;
  tab: HubTab;
  openThreadIds: number[];
  minimizedThreadIds: number[];
  activeThreadId: number | null;
  lastOpenedAt: string | null;
};

type ComposerAutocomplete = {
  threadId: number;
  tokenType: AutocompleteTokenType;
  query: string;
  start: number;
  end: number;
  items: CommunicationTokenSuggestion[];
  loading: boolean;
};

const EMPTY_SUMMARY: CommunicationSummary = {
  unreadMessages: 0,
  messageRequests: 0,
  friendRequests: 0,
  totalAttention: 0,
};

const safeThreadId = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
};

const uniqueThreadIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<number>();
  const result: number[] = [];
  for (const item of value) {
    const threadId = safeThreadId(item);
    if (threadId == null || seen.has(threadId)) {
      continue;
    }
    seen.add(threadId);
    result.push(threadId);
  }
  return result;
};

const reorderThreadIds = (threadIds: number[], sourceId: number, targetId: number): number[] => {
  if (sourceId === targetId) {
    return threadIds;
  }
  const sourceIndex = threadIds.indexOf(sourceId);
  const targetIndex = threadIds.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return threadIds;
  }
  const next = [...threadIds];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
};

const parseUiState = (value: unknown): HubUiState => {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const openThreadIds = uniqueThreadIds(raw.openThreadIds);
  const minimizedThreadIds = uniqueThreadIds(raw.minimizedThreadIds).filter((threadId) =>
    openThreadIds.includes(threadId),
  );
  const activeThreadId = safeThreadId(raw.activeThreadId);
  return {
    version: Number(raw.version ?? UI_STATE_VERSION),
    hubOpen: Boolean(raw.hubOpen),
    tab: TABS.includes(raw.tab as HubTab) ? (raw.tab as HubTab) : 'threads',
    openThreadIds,
    minimizedThreadIds,
    activeThreadId:
      activeThreadId != null && openThreadIds.includes(activeThreadId)
        ? activeThreadId
        : openThreadIds[openThreadIds.length - 1] ?? null,
    lastOpenedAt: raw.lastOpenedAt == null ? null : String(raw.lastOpenedAt),
  };
};

const relativeTime = (iso: string | null): string => {
  if (!iso) {
    return 'neznámý čas';
  }
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    return iso;
  }
  const diff = Date.now() - ms;
  if (diff < 60000) {
    return 'právě teď';
  }
  if (diff < 60 * 60000) {
    return `před ${Math.floor(diff / 60000)} min`;
  }
  if (diff < 24 * 60 * 60000) {
    return `před ${Math.floor(diff / (60 * 60000))} h`;
  }
  return new Date(ms).toLocaleString('cs-CZ');
};

const mergeThreadMeta = (
  previous: Record<number, CommunicationThreadSummary>,
  threads: CommunicationThreadSummary[],
): Record<number, CommunicationThreadSummary> => {
  if (threads.length === 0) {
    return previous;
  }
  const next = { ...previous };
  for (const thread of threads) {
    next[thread.id] = thread;
  }
  return next;
};

const countNewSinceLastOpen = (inbox: CommunicationInboxResponse | null, lastOpenedAt: string | null): number => {
  if (!inbox) {
    return 0;
  }
  if (!lastOpenedAt) {
    return Math.max(0, Number(inbox.summary.totalAttention ?? 0));
  }
  const lastOpenedMs = Date.parse(lastOpenedAt);
  if (!Number.isFinite(lastOpenedMs)) {
    return Math.max(0, Number(inbox.summary.totalAttention ?? 0));
  }
  let unread = 0;
  for (const thread of inbox.threads) {
    if (thread.unreadCount <= 0) {
      continue;
    }
    const activityMs = Date.parse(thread.lastActivityAt);
    if (Number.isFinite(activityMs) && activityMs > lastOpenedMs) {
      unread += thread.unreadCount;
    }
  }
  return unread + (inbox.friendRequests?.incoming?.length ?? 0);
};

const getAutocompleteContext = (
  value: string,
  caret: number,
): {
  tokenType: AutocompleteTokenType;
  query: string;
  start: number;
  end: number;
} | null => {
  const safeCaret = Math.max(0, Math.min(caret, value.length));
  const left = value.slice(0, safeCaret);

  const userMatch = left.match(/(^|\s)(@)([^\s@#_]{1,32})$/u);
  if (userMatch && userMatch.index != null) {
    const markerIndex = userMatch.index + userMatch[1].length;
    return {
      tokenType: 'user',
      query: userMatch[3],
      start: markerIndex,
      end: safeCaret,
    };
  }

  const kingdomMatch = left.match(/(^|\s)(#)([^\s@#_]{1,32})$/u);
  if (kingdomMatch && kingdomMatch.index != null) {
    const markerIndex = kingdomMatch.index + kingdomMatch[1].length;
    return {
      tokenType: 'kingdom',
      query: kingdomMatch[3],
      start: markerIndex,
      end: safeCaret,
    };
  }

  const villageMatch = left.match(/(^|\s)(_)([^\s_]{1,16})$/u);
  if (villageMatch && villageMatch.index != null) {
    const markerIndex = villageMatch.index + villageMatch[1].length;
    return {
      tokenType: 'village',
      query: villageMatch[3],
      start: markerIndex,
      end: safeCaret,
    };
  }

  return null;
};

const getAvatarFallback = (username: string): string => {
  const normalized = String(username ?? '').trim();
  if (!normalized) {
    return '?';
  }
  return normalized[0].toLocaleUpperCase('cs-CZ');
};

const normalizeComparableUsername = (value: unknown): string =>
  String(value ?? '').trim().toLocaleLowerCase('cs-CZ');

const isInboxOwnedByUsername = (data: CommunicationInboxResponse, username: string | null): boolean => {
  const responseUsername = normalizeComparableUsername(data?.me?.username ?? '');
  const currentUsername = normalizeComparableUsername(username ?? '');
  return Boolean(responseUsername) && Boolean(currentUsername) && responseUsername === currentUsername;
};

const getSuggestionLabel = (item: CommunicationTokenSuggestion): string => {
  if (item.kind === 'user') {
    return `@${item.label}`;
  }
  if (item.kind === 'kingdom') {
    return `#${item.label}`;
  }
  return item.label;
};

const buildMessagePreview = (message: CommunicationMessage | null): string => {
  if (!message) {
    return 'Bez zpráv.';
  }
  const body = String(message.body ?? '').trim();
  if (body) {
    return body;
  }
  if (message.payload && typeof message.payload === 'object') {
    const payload = message.payload as Record<string, unknown>;
    if (String(payload.kind ?? '') === 'notification-share') {
      return 'Sdílené oznámení';
    }
    if (String(payload.kind ?? '') === 'internal-link') {
      return 'Sdílený odkaz';
    }
  }
  return 'Zpráva bez textu';
};

export const CommunicationHub = () => {
  const location = useLocation();
  const session = getSession();
  const username = session?.username ?? null;
  const [inbox, setInbox] = useState<CommunicationInboxResponse | null>(null);
  const [summaryState, setSummaryState] = useState<CommunicationSummary>(EMPTY_SUMMARY);
  const [messagesByThreadId, setMessagesByThreadId] = useState<Record<number, CommunicationMessage[]>>({});
  const [threadMetaById, setThreadMetaById] = useState<Record<number, CommunicationThreadSummary>>({});
  const [hubOpen, setHubOpen] = useState(false);
  const [tab, setTab] = useState<HubTab>('threads');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<CommunicationTokenSuggestion[]>([]);
  const [openThreadIds, setOpenThreadIds] = useState<number[]>([]);
  const [minimizedThreadIds, setMinimizedThreadIds] = useState<number[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [threadDrafts, setThreadDrafts] = useState<Record<number, string>>({});
  const [lastOpenedAt, setLastOpenedAt] = useState<string | null>(null);
  const [draggedThreadId, setDraggedThreadId] = useState<number | null>(null);
  const [quickOpenDraft, setQuickOpenDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [autocomplete, setAutocomplete] = useState<ComposerAutocomplete | null>(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth <= MOBILE_BREAKPOINT,
  );
  const initializedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const savedSnapshotRef = useRef('');
  const requestIdRef = useRef(0);
  const previousUsernameRef = useRef<string | null>(null);
  const composerRefByThreadId = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const chatBodyRefByThreadId = useRef<Record<number, HTMLDivElement | null>>({});
  const isInGame = location.pathname.startsWith('/game');

  const normalizeEmojiTokens = useCallback((value: string): string => {
    let next = String(value ?? '');
    for (const entry of EMOJI_TOKEN_REPLACEMENTS) {
      next = next.replace(entry.pattern, entry.replacement);
    }
    return next;
  }, []);

  const summary = inbox?.summary ?? summaryState;
  const badgeCount = useMemo(() => {
    if (hubOpen || openThreadIds.length > 0) {
      return countNewSinceLastOpen(inbox, lastOpenedAt);
    }
    return Math.max(0, Number(summary.totalAttention ?? 0));
  }, [hubOpen, inbox, lastOpenedAt, openThreadIds.length, summary.totalAttention]);

  const resetCommunicationState = useCallback(() => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    requestIdRef.current += 1;
    initializedRef.current = false;
    savedSnapshotRef.current = '';
    setInbox(null);
    setSummaryState(EMPTY_SUMMARY);
    setMessagesByThreadId({});
    setThreadMetaById({});
    setHubOpen(false);
    setTab('threads');
    setSearchDraft('');
    setSearchSuggestions([]);
    setOpenThreadIds([]);
    setMinimizedThreadIds([]);
    setActiveThreadId(null);
    setThreadDrafts({});
    setLastOpenedAt(null);
    setDraggedThreadId(null);
    setQuickOpenDraft('');
    setActionKey(null);
    setAutocomplete(null);
  }, []);

  const updateInbox = useCallback(
    (data: CommunicationInboxResponse): boolean => {
      if (!isInboxOwnedByUsername(data, username)) {
        resetCommunicationState();
        setError('Komunikace byla zablokována: dorazila data jiného účtu.');
        return false;
      }
      setInbox(data);
      setSummaryState(data.summary ?? EMPTY_SUMMARY);
      setThreadMetaById((previous) => mergeThreadMeta(previous, data.threads ?? []));
      return true;
    },
    [resetCommunicationState, username],
  );

  useEffect(() => {
    if (previousUsernameRef.current === username) {
      return;
    }
    previousUsernameRef.current = username;
    resetCommunicationState();
    setError(null);
  }, [resetCommunicationState, username]);

  const shouldResetOnAuthorizationError = useCallback((error: unknown): boolean => {
    const message = error instanceof Error ? String(error.message ?? '') : String(error ?? '');
    const normalized = message.toLocaleLowerCase('cs-CZ');
    return (
      normalized.includes('http 401') ||
      normalized.includes('http 403') ||
      normalized.includes('neplatne prihlasovaci udaje') ||
      normalized.includes('ucet v requestu neodpovida prihlasene session')
    );
  }, []);

  const refreshMessages = useCallback(
    async (threadIds: number[], requestId: number) => {
      if (!username || threadIds.length === 0) {
        return;
      }
      const ids = uniqueThreadIds(threadIds);
      if (ids.length === 0) {
        return;
      }
      const responses = await Promise.allSettled(
        ids.map((threadId) =>
          fetchCommunicationInbox(username, {
            threadId,
            messageLimit: MAX_MESSAGES,
          }),
        ),
      );
      if (requestId !== requestIdRef.current) {
        return;
      }
      setMessagesByThreadId((previous) => {
        const next = { ...previous };
        for (let index = 0; index < responses.length; index += 1) {
          const response = responses[index];
          if (response.status !== 'fulfilled') {
            continue;
          }
          const threadId = ids[index];
          if (!updateInbox(response.value)) {
            continue;
          }
          next[threadId] = response.value.selectedMessages ?? [];
        }
        return next;
      });
    },
    [updateInbox, username],
  );

  const loadInbox = useCallback(async () => {
    if (!username) {
      return;
    }
    const requestId = ++requestIdRef.current;
    try {
      const data = await fetchCommunicationInbox(username, {
        threadLimit: 80,
        messageLimit: MAX_MESSAGES,
        threadId: activeThreadId ?? undefined,
      });
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (!updateInbox(data)) {
        return;
      }
      if (data.selectedThreadId != null) {
        setMessagesByThreadId((previous) => ({
          ...previous,
          [Number(data.selectedThreadId)]: data.selectedMessages ?? [],
        }));
      }
      const selectedThreadId =
        data.selectedThreadId != null && Number.isFinite(Number(data.selectedThreadId))
          ? Number(data.selectedThreadId)
          : null;
      const additionalThreadIds = uniqueThreadIds(openThreadIds).filter((threadId) => threadId !== selectedThreadId);
      await refreshMessages(additionalThreadIds, requestId);
      setError(null);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (shouldResetOnAuthorizationError(loadError)) {
        resetCommunicationState();
      }
      setError(loadError instanceof Error ? loadError.message : 'Komunikace se nepodařila načíst.');
    }
  }, [
    activeThreadId,
    openThreadIds,
    refreshMessages,
    resetCommunicationState,
    shouldResetOnAuthorizationError,
    updateInbox,
    username,
  ]);

  const loadSummary = useCallback(async () => {
    if (!username) {
      return;
    }
    try {
      const data = await fetchCommunicationSummary(username);
      setSummaryState(data.summary ?? EMPTY_SUMMARY);
      setError(null);
    } catch (loadError) {
      if (shouldResetOnAuthorizationError(loadError)) {
        resetCommunicationState();
      }
      setError(loadError instanceof Error ? loadError.message : 'Souhrn komunikace se nepodarilo nacist.');
    }
  }, [resetCommunicationState, shouldResetOnAuthorizationError, username]);

  const closeThread = useCallback((threadId: number) => {
    setOpenThreadIds((previous) => previous.filter((id) => id !== threadId));
    setMinimizedThreadIds((previous) => previous.filter((id) => id !== threadId));
    setThreadDrafts((previous) => {
      if (!(threadId in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[threadId];
      return next;
    });
    setActiveThreadId((previous) => (previous === threadId ? null : previous));
  }, []);

  const ensureThreadOpen = useCallback((threadId: number) => {
    setOpenThreadIds((previous) => (previous.includes(threadId) ? previous : [...previous, threadId]));
    setMinimizedThreadIds((previous) => previous.filter((id) => id !== threadId));
    setActiveThreadId(threadId);
    setLastOpenedAt(new Date().toISOString());
  }, []);

  const openThreadById = useCallback(
    async (threadId: number) => {
      if (!username) {
        return null;
      }
      const normalizedThreadId = safeThreadId(threadId);
      if (normalizedThreadId == null) {
        return null;
      }
      setActionKey(`open-thread-${normalizedThreadId}`);
      try {
        const response = await openCommunicationThreadRequest(username, { threadId: normalizedThreadId });
        if (!updateInbox(response.data)) {
          return null;
        }
        setMessagesByThreadId((previous) => ({
          ...previous,
          [normalizedThreadId]: response.data.selectedMessages ?? [],
        }));
        ensureThreadOpen(normalizedThreadId);
        setError(null);
        return normalizedThreadId;
      } catch (mutationError) {
        setError(mutationError instanceof Error ? mutationError.message : 'Konverzaci nejde otevřít.');
        return null;
      } finally {
        setActionKey(null);
      }
    },
    [ensureThreadOpen, updateInbox, username],
  );

  const openThreadByUsername = useCallback(
    async (targetUsername: string) => {
      if (!username) {
        return null;
      }
      const normalized = String(targetUsername).trim().replace(/^@/, '');
      if (!normalized) {
        return null;
      }
      setActionKey(`open-user-${normalized.toLocaleLowerCase('cs-CZ')}`);
      try {
        const response = await openCommunicationThreadRequest(username, { targetUsername: normalized });
        if (!updateInbox(response.data)) {
          return null;
        }
        setMessagesByThreadId((previous) => ({
          ...previous,
          [response.result.threadId]: response.data.selectedMessages ?? [],
        }));
        ensureThreadOpen(response.result.threadId);
        setQuickOpenDraft('');
        setError(null);
        return response.result.threadId;
      } catch (mutationError) {
        setError(mutationError instanceof Error ? mutationError.message : 'Konverzaci nejde otevřít.');
        return null;
      } finally {
        setActionKey(null);
      }
    },
    [ensureThreadOpen, updateInbox, username],
  );

  useEffect(() => {
    if (!username) {
      return;
    }
    if (hubOpen || openThreadIds.length > 0) {
      void loadInbox();
    } else {
      void loadSummary();
    }
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      if (hubOpen || openThreadIds.length > 0) {
        void loadInbox();
      } else {
        void loadSummary();
      }
    }, hubOpen || openThreadIds.length > 0 ? POLL_MS : SUMMARY_POLL_MS);
    return () => window.clearInterval(timer);
  }, [hubOpen, loadInbox, loadSummary, openThreadIds.length, username]);

  useEffect(() => {
    if (!inbox || initializedRef.current) {
      return;
    }
    const state = parseUiState(inbox.uiState.communication);
    setHubOpen(state.hubOpen);
    setTab(state.tab);
    setOpenThreadIds(state.openThreadIds);
    setMinimizedThreadIds(state.minimizedThreadIds);
    setActiveThreadId(state.activeThreadId);
    setLastOpenedAt(state.lastOpenedAt);
    savedSnapshotRef.current = JSON.stringify(state);
    initializedRef.current = true;
  }, [inbox]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const detail: CommunicationSummaryEventDetail = {
      unreadMessages: Number(summary.unreadMessages ?? 0),
      messageRequests: Number(summary.messageRequests ?? 0),
      friendRequests: Number(summary.friendRequests ?? 0),
      totalAttention: Number(summary.totalAttention ?? 0),
      newSinceLastOpen: badgeCount,
      hubOpen,
    };
    window.dispatchEvent(new CustomEvent(COMMUNICATION_SUMMARY_EVENT, { detail }));
  }, [badgeCount, hubOpen, summary.friendRequests, summary.messageRequests, summary.totalAttention, summary.unreadMessages]);

  useEffect(() => {
    const onOpen = () => {
      setHubOpen(true);
      setLastOpenedAt(new Date().toISOString());
    };
    const onOpenThread = (event: Event) => {
      const detail = (event as CustomEvent<CommunicationOpenThreadEventDetail>).detail;
      const targetUsername = String(detail?.targetUsername ?? '').trim();
      if (!targetUsername) {
        return;
      }
      setHubOpen(true);
      setLastOpenedAt(new Date().toISOString());
      void openThreadByUsername(targetUsername);
    };
    const onSendPayload = (event: Event) => {
      const detail = (event as CustomEvent<CommunicationSendPayloadEventDetail>).detail;
      const targetUsername = String(detail?.targetUsername ?? '').trim();
      if (!targetUsername || !username) {
        return;
      }
      const body = String(detail?.body ?? '').trim();
      const payload =
        detail?.payload && typeof detail.payload === 'object' ? (detail.payload as CommunicationMessagePayload) : null;
      setHubOpen(true);
      setLastOpenedAt(new Date().toISOString());
      void openThreadByUsername(targetUsername).then((threadId) => {
        if (threadId == null) {
          return;
        }
        if (!body && !payload) {
          return;
        }
        void sendCommunicationMessageRequest(username, {
          threadId,
          body,
          payload,
        })
          .then((response) => {
            if (!updateInbox(response.data)) {
              return;
            }
            setMessagesByThreadId((previous) => ({
              ...previous,
              [threadId]: response.data.selectedMessages ?? previous[threadId] ?? [],
            }));
          })
          .catch(() => undefined);
      });
    };

    window.addEventListener(COMMUNICATION_OPEN_EVENT, onOpen);
    window.addEventListener(COMMUNICATION_OPEN_THREAD_EVENT, onOpenThread as EventListener);
    window.addEventListener(COMMUNICATION_SEND_PAYLOAD_EVENT, onSendPayload as EventListener);
    return () => {
      window.removeEventListener(COMMUNICATION_OPEN_EVENT, onOpen);
      window.removeEventListener(COMMUNICATION_OPEN_THREAD_EVENT, onOpenThread as EventListener);
      window.removeEventListener(COMMUNICATION_SEND_PAYLOAD_EVENT, onSendPayload as EventListener);
    };
  }, [openThreadByUsername, updateInbox, username]);

  useEffect(() => {
    const currentThreadIds = new Set((inbox?.threads ?? []).map((thread) => Number(thread.id)));
    if (currentThreadIds.size === 0) {
      return;
    }
    setOpenThreadIds((previous) => previous.filter((threadId) => currentThreadIds.has(threadId)));
  }, [inbox?.threads]);

  useEffect(() => {
    setMinimizedThreadIds((previous) => previous.filter((threadId) => openThreadIds.includes(threadId)));
    setActiveThreadId((previous) =>
      previous != null && openThreadIds.includes(previous) ? previous : openThreadIds[0] ?? null,
    );
  }, [openThreadIds]);

  const uiState = useMemo<HubUiState>(
    () => ({
      version: UI_STATE_VERSION,
      hubOpen,
      tab,
      openThreadIds,
      minimizedThreadIds,
      activeThreadId,
      lastOpenedAt,
    }),
    [activeThreadId, hubOpen, lastOpenedAt, minimizedThreadIds, openThreadIds, tab],
  );

  useEffect(() => {
    if (!username || !initializedRef.current) {
      return;
    }
    const serialized = JSON.stringify(uiState);
    if (serialized === savedSnapshotRef.current) {
      return;
    }
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void setCommunicationUiStateRequest(username, uiState as unknown as Record<string, unknown>)
        .then(() => {
          savedSnapshotRef.current = serialized;
        })
        .catch(() => undefined);
    }, UI_STATE_SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [uiState, username]);

  useEffect(() => {
    const query = searchDraft.trim().replace(/^@/, '');
    if (!username || !query) {
      setSearchSuggestions([]);
      return;
    }
    let cancelled = false;
    void fetchCommunicationTokenSuggestions(username, {
      tokenType: 'user',
      query,
      limit: 10,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setSearchSuggestions(response.suggestions ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setSearchSuggestions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [searchDraft, username]);

  useEffect(() => {
    if (!autocomplete || !username) {
      return;
    }
    const query = autocomplete.query.trim();
    if (!query) {
      setAutocomplete((previous) => (previous == null ? null : { ...previous, items: [], loading: false }));
      return;
    }
    let cancelled = false;
    setAutocomplete((previous) => (previous == null ? null : { ...previous, loading: true }));
    void fetchCommunicationTokenSuggestions(username, {
      tokenType: autocomplete.tokenType,
      query,
      limit: 10,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setAutocomplete((previous) => {
          if (
            previous == null ||
            previous.threadId !== autocomplete.threadId ||
            previous.tokenType !== autocomplete.tokenType ||
            previous.query !== autocomplete.query
          ) {
            return previous;
          }
          return {
            ...previous,
            items: response.suggestions ?? [],
            loading: false,
          };
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setAutocomplete((previous) => (previous == null ? null : { ...previous, items: [], loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [autocomplete, username]);

  const filteredThreads = useMemo(() => {
    const threads = inbox?.threads ?? [];
    const query = searchDraft.trim().toLocaleLowerCase('cs-CZ');
    if (!query) {
      return threads;
    }
    return threads.filter((thread) => {
      const userMatch = thread.otherPlayer.username.toLocaleLowerCase('cs-CZ').includes(query);
      const previewMatch = buildMessagePreview(thread.lastMessage).toLocaleLowerCase('cs-CZ').includes(query);
      return userMatch || previewMatch;
    });
  }, [inbox?.threads, searchDraft]);

  const messageRequestThreads = useMemo(
    () => (inbox?.threads ?? []).filter((thread) => Boolean(thread.isMessageRequest)),
    [inbox?.threads],
  );

  const friendByUsername = useMemo(() => {
    const map = new Map<string, CommunicationFriend>();
    for (const friend of inbox?.friends ?? []) {
      map.set(friend.username.toLocaleLowerCase('cs-CZ'), friend);
    }
    return map;
  }, [inbox?.friends]);

  const threadById = useMemo(() => {
    const map = new Map<number, CommunicationThreadSummary>();
    for (const thread of inbox?.threads ?? []) {
      map.set(Number(thread.id), thread);
    }
    for (const [threadId, thread] of Object.entries(threadMetaById)) {
      const parsed = Number(threadId);
      if (!Number.isFinite(parsed)) {
        continue;
      }
      if (!map.has(parsed)) {
        map.set(parsed, thread);
      }
    }
    return map;
  }, [inbox?.threads, threadMetaById]);

  const handleThreadDraftChange = useCallback(
    (threadId: number, value: string, caret: number) => {
      setThreadDrafts((previous) => ({
        ...previous,
        [threadId]: value,
      }));
      const context = getAutocompleteContext(value, caret);
      if (!context) {
        setAutocomplete((previous) => (previous?.threadId === threadId ? null : previous));
        return;
      }
      setAutocomplete({
        threadId,
        tokenType: context.tokenType,
        query: context.query,
        start: context.start,
        end: context.end,
        items: [],
        loading: true,
      });
    },
    [],
  );

  const applyAutocompleteSuggestion = useCallback((threadId: number, suggestion: CommunicationTokenSuggestion) => {
    setAutocomplete((previous) => {
      if (!previous || previous.threadId !== threadId) {
        return previous;
      }
      setThreadDrafts((drafts) => {
        const draft = drafts[threadId] ?? '';
        const nextDraft = `${draft.slice(0, previous.start)}${suggestion.value} ${draft.slice(previous.end)}`;
        return {
          ...drafts,
          [threadId]: nextDraft,
        };
      });
      window.setTimeout(() => {
        const target = composerRefByThreadId.current[threadId];
        if (!target) {
          return;
        }
        const nextCaret = previous.start + suggestion.value.length + 1;
        target.focus();
        target.selectionStart = nextCaret;
        target.selectionEnd = nextCaret;
      }, 0);
      return null;
    });
  }, []);

  const sendMessage = useCallback(
    async (threadId: number, body: string, payload: CommunicationMessagePayload | null = null) => {
      if (!username) {
        return;
      }
      const normalizedBody = normalizeEmojiTokens(String(body ?? '').trim()).slice(0, MAX_BODY_LENGTH);
      if (!normalizedBody && payload == null) {
        return;
      }
      setActionKey(`send-${threadId}`);
      try {
        const response = await sendCommunicationMessageRequest(username, {
          threadId,
          body: normalizedBody,
          payload,
        });
        if (!updateInbox(response.data)) {
          return;
        }
        setMessagesByThreadId((previous) => ({
          ...previous,
          [threadId]: response.data.selectedMessages ?? previous[threadId] ?? [],
        }));
        setThreadDrafts((previous) => ({
          ...previous,
          [threadId]: '',
        }));
        setAutocomplete((previous) => (previous?.threadId === threadId ? null : previous));
        setError(null);
      } catch (sendError) {
        setError(sendError instanceof Error ? sendError.message : 'Zprávu se nepodařilo odeslat.');
      } finally {
        setActionKey(null);
      }
    },
    [normalizeEmojiTokens, updateInbox, username],
  );

  const sendEmoji = useCallback(
    (threadId: number, emoji: string) => {
      setThreadDrafts((previous) => {
        const current = previous[threadId] ?? '';
        const separator = current.trim().length > 0 ? ' ' : '';
        return {
          ...previous,
          [threadId]: `${current}${separator}${emoji}`,
        };
      });
      window.setTimeout(() => {
        const target = composerRefByThreadId.current[threadId];
        if (!target) {
          return;
        }
        target.focus();
        target.selectionStart = target.value.length;
        target.selectionEnd = target.value.length;
      }, 0);
    },
    [],
  );

  useEffect(() => {
    for (const threadId of openThreadIds) {
      const bodyNode = chatBodyRefByThreadId.current[threadId];
      if (!bodyNode) {
        continue;
      }
      bodyNode.scrollTop = bodyNode.scrollHeight;
    }
  }, [messagesByThreadId, openThreadIds]);

  const handleDeleteMessage = useCallback(
    async (messageId: number) => {
      if (!username) {
        return;
      }
      setActionKey(`delete-message-${messageId}`);
      try {
        const response = await deleteCommunicationMessageRequest(username, messageId);
        if (!updateInbox(response.data)) {
          return;
        }
        const affectedThreadId = Number(response.result.threadId);
        if (Number.isFinite(affectedThreadId) && affectedThreadId > 0) {
          setMessagesByThreadId((previous) => ({
            ...previous,
            [affectedThreadId]: response.data.selectedMessages ?? previous[affectedThreadId] ?? [],
          }));
        }
      } catch (mutationError) {
        setError(mutationError instanceof Error ? mutationError.message : 'Zprávu nelze smazat.');
      } finally {
        setActionKey(null);
      }
    },
    [updateInbox, username],
  );

  const handleArchiveThread = useCallback(
    async (threadId: number) => {
      if (!username) {
        return;
      }
      setActionKey(`archive-thread-${threadId}`);
      try {
        const response = await archiveCommunicationThreadRequest(username, threadId);
        if (!updateInbox(response.data)) {
          return;
        }
        closeThread(threadId);
      } catch (mutationError) {
        setError(mutationError instanceof Error ? mutationError.message : 'Konverzaci nelze archivovat.');
      } finally {
        setActionKey(null);
      }
    },
    [closeThread, updateInbox, username],
  );

  const handleFriendRequestResponse = useCallback(
    async (requestId: number, action: 'accept' | 'reject') => {
      if (!username) {
        return;
      }
      setActionKey(`friend-request-${requestId}-${action}`);
      try {
        const response = await respondCommunicationFriendRequest(username, requestId, action);
        if (!updateInbox(response.data)) {
          return;
        }
      } catch (mutationError) {
        setError(mutationError instanceof Error ? mutationError.message : 'Žádost nejde zpracovat.');
      } finally {
        setActionKey(null);
      }
    },
    [updateInbox, username],
  );

  const handleSendFriendRequest = useCallback(
    async (targetUsername: string) => {
      if (!username) {
        return;
      }
      const normalized = String(targetUsername ?? '').trim().replace(/^@/, '');
      if (!normalized) {
        return;
      }
      setActionKey(`friend-send-${normalized.toLocaleLowerCase('cs-CZ')}`);
      try {
        const response = await sendCommunicationFriendRequest(username, normalized);
        if (!updateInbox(response.data)) {
          return;
        }
      } catch (mutationError) {
        setError(mutationError instanceof Error ? mutationError.message : 'Žádost o přátelství nejde odeslat.');
      } finally {
        setActionKey(null);
      }
    },
    [updateInbox, username],
  );

  const handleRemoveFriend = useCallback(
    async (targetUsername: string) => {
      if (!username) {
        return;
      }
      const normalized = String(targetUsername ?? '').trim();
      if (!normalized) {
        return;
      }
      setActionKey(`friend-remove-${normalized.toLocaleLowerCase('cs-CZ')}`);
      try {
        const response = await removeCommunicationFriend(username, normalized);
        if (!updateInbox(response.data)) {
          return;
        }
      } catch (mutationError) {
        setError(mutationError instanceof Error ? mutationError.message : 'Kontakt nejde odstranit.');
      } finally {
        setActionKey(null);
      }
    },
    [updateInbox, username],
  );

  const handleBlock = useCallback(
    async (targetUsername: string) => {
      if (!username) {
        return;
      }
      const normalized = String(targetUsername ?? '').trim();
      if (!normalized) {
        return;
      }
      setActionKey(`block-${normalized.toLocaleLowerCase('cs-CZ')}`);
      try {
        const response = await blockCommunicationPlayer(username, normalized);
        if (!updateInbox(response.data)) {
          return;
        }
      } catch (mutationError) {
        setError(mutationError instanceof Error ? mutationError.message : 'Hráče nelze zablokovat.');
      } finally {
        setActionKey(null);
      }
    },
    [updateInbox, username],
  );

  const handleUnblock = useCallback(
    async (targetUsername: string) => {
      if (!username) {
        return;
      }
      const normalized = String(targetUsername ?? '').trim();
      if (!normalized) {
        return;
      }
      setActionKey(`unblock-${normalized.toLocaleLowerCase('cs-CZ')}`);
      try {
        const response = await unblockCommunicationPlayer(username, normalized);
        if (!updateInbox(response.data)) {
          return;
        }
      } catch (mutationError) {
        setError(mutationError instanceof Error ? mutationError.message : 'Hráče nelze odblokovat.');
      } finally {
        setActionKey(null);
      }
    },
    [updateInbox, username],
  );

  const dispatchTokenClick = useCallback((token: string, shareToken?: string | null, reportId?: number | null) => {
    if (typeof window === 'undefined') {
      return;
    }
    window.dispatchEvent(
      new CustomEvent(TOKEN_CLICK_EVENT, {
        detail: {
          token,
          shareToken: shareToken == null ? null : String(shareToken).trim(),
          reportId:
            reportId != null && Number.isFinite(Number(reportId)) && Number(reportId) > 0
              ? Math.floor(Number(reportId))
              : null,
        },
      }),
    );
  }, []);

  const renderMessageBody = useCallback(
    (message: CommunicationMessage): ReactNode => {
      const body = String(message.body ?? '');
      const parts = body.split(MESSAGE_TOKEN_REGEX).filter((part) => part.length > 0);
      const payload = message.payload as Record<string, unknown> | null;
      const nodes = parts.map((part, index) => {
        const isToken = MESSAGE_TOKEN_REGEX.test(part);
        MESSAGE_TOKEN_REGEX.lastIndex = 0;
        if (!isToken) {
          return <span key={`msg-part-${message.id}-${index}`}>{part}</span>;
        }
        const isClickable = isInGame;
        return (
          <button
            key={`msg-token-${message.id}-${index}`}
            type="button"
            className={`communication-inline-token ${isClickable ? 'is-clickable' : ''}`}
            onClick={() => {
              if (!isClickable) {
                return;
              }
              dispatchTokenClick(part);
            }}
            disabled={!isClickable}
          >
            {part}
          </button>
        );
      });

      if (!payload || typeof payload !== 'object') {
        return <>{nodes}</>;
      }

      const payloadKind = String(payload.kind ?? '').trim().toLowerCase();
      if (payloadKind === 'notification-share') {
        const notificationId = Number(payload.notificationId ?? 0);
        const shareToken = String(payload.shareToken ?? '').trim();
        const reportId = Number(payload.reportId ?? 0);
        const token = notificationId > 0 ? `//Oznámení:${notificationId}` : '';
        const label = String(payload.label ?? 'Sdílené oznámení').trim();
        if (!token) {
          return <>{nodes}</>;
        }
        return (
          <>
            {nodes}{' '}
            <button
              type="button"
              className={`communication-inline-token ${isInGame ? 'is-clickable' : ''}`}
              onClick={() => {
                if (!isInGame) {
                  return;
                }
                dispatchTokenClick(token, shareToken, reportId);
              }}
              disabled={!isInGame}
            >
              {label}
            </button>
          </>
        );
      }

      return <>{nodes}</>;
    },
    [dispatchTokenClick, isInGame],
  );

  if (!username) {
    return null;
  }

  const renderChatThread = (threadId: number) => {
    const thread = threadById.get(threadId) ?? null;
    if (!thread) {
      return null;
    }
    const isMinimized = minimizedThreadIds.includes(threadId);
    const isActive = activeThreadId === threadId;
    const messages = [...(messagesByThreadId[threadId] ?? [])].sort((left, right) => left.id - right.id);
    const draft = threadDrafts[threadId] ?? '';
    const isSendPending = actionKey === `send-${threadId}`;
    const isArchivePending = actionKey === `archive-thread-${threadId}`;

    if (isMinimized) {
      return (
        <button
          key={`chat-bubble-${threadId}`}
          type="button"
          className="communication-chat-bubble"
          onClick={() => {
            setMinimizedThreadIds((previous) => previous.filter((id) => id !== threadId));
            setActiveThreadId(threadId);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            closeThread(threadId);
          }}
          draggable={!isMobile}
          onDragStart={() => setDraggedThreadId(threadId)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (draggedThreadId == null) {
              return;
            }
            setOpenThreadIds((previous) => reorderThreadIds(previous, draggedThreadId, threadId));
            setDraggedThreadId(null);
          }}
        >
          <span>{thread.otherPlayer.username}</span>
          {thread.unreadCount > 0 ? <strong>{thread.unreadCount > 99 ? '99+' : thread.unreadCount}</strong> : null}
        </button>
      );
    }

    return (
      <section
        key={`chat-overlay-${threadId}`}
        className={`communication-chat-overlay ${isActive ? 'is-active' : 'is-idle'} ${isMobile ? 'is-mobile' : ''}`}
        onMouseDown={() => setActiveThreadId(threadId)}
        onContextMenu={(event) => {
          event.preventDefault();
          closeThread(threadId);
        }}
        draggable={!isMobile}
        onDragStart={() => setDraggedThreadId(threadId)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => {
          if (draggedThreadId == null) {
            return;
          }
          setOpenThreadIds((previous) => reorderThreadIds(previous, draggedThreadId, threadId));
          setDraggedThreadId(null);
        }}
      >
        <header className="communication-chat-header">
          <span className="communication-user-chip">
            <span className="communication-user-avatar tiny" aria-hidden="true">
              {thread.otherPlayer.avatarUrl ? (
                <img src={thread.otherPlayer.avatarUrl} alt="" loading="lazy" />
              ) : (
                getAvatarFallback(thread.otherPlayer.username)
              )}
            </span>
            <strong>{thread.otherPlayer.username}</strong>
          </span>
          <small>{thread.otherPlayer.isOnline ? 'Online' : relativeTime(thread.otherPlayer.lastActiveAt)}</small>
          <div className="communication-row-actions">
            <button
              type="button"
              className="secondary-action danger"
              onClick={() => {
                void handleArchiveThread(threadId);
              }}
              disabled={isArchivePending}
            >
              Archivovat
            </button>
            <button type="button" className="secondary-action danger" onClick={() => closeThread(threadId)}>
              Zavřít
            </button>
          </div>
        </header>

        <div
          className="communication-chat-body"
          ref={(node) => {
            chatBodyRefByThreadId.current[threadId] = node;
          }}
        >
          {messages.length > 0 ? (
            messages.map((message) => {
              const isMine =
                message.senderUsername.toLocaleLowerCase('cs-CZ') === username.toLocaleLowerCase('cs-CZ');
              return (
                <article key={`chat-message-${message.id}`} className={`communication-chat-message ${isMine ? 'is-mine' : 'is-other'}`}>
                  <header>
                    <strong>{message.senderUsername}</strong>
                    <small>{relativeTime(message.createdAt)}</small>
                  </header>
                  <p>{renderMessageBody(message)}</p>
                  {isMine && message.deletedAt == null ? (
                    <button
                      type="button"
                      className="secondary-action danger communication-message-delete"
                      onClick={() => {
                        void handleDeleteMessage(message.id);
                      }}
                      disabled={actionKey === `delete-message-${message.id}`}
                    >
                      Smazat
                    </button>
                  ) : null}
                </article>
              );
            })
          ) : (
            <p className="communication-list-empty">Zatím bez zpráv.</p>
          )}
        </div>

        <footer className="communication-chat-footer">
          {autocomplete && autocomplete.threadId === threadId ? (
            <div className="communication-composer-suggestions">
              <small>
                Napovídání ({autocomplete.tokenType}) {autocomplete.loading ? '· načítám…' : ''}
              </small>
              <ul>
                {autocomplete.items.map((item) => (
                  <li key={`composer-suggestion-${threadId}-${item.kind}-${item.value}`}>
                    <button type="button" className="secondary-action" onClick={() => applyAutocompleteSuggestion(threadId, item)}>
                      {getSuggestionLabel(item)}
                    </button>
                    <span>
                      {item.kind === 'user'
                        ? item.relation === 'friend'
                          ? 'Přítel'
                          : item.relation === 'kingdom'
                            ? 'Království'
                            : 'Cizí hráč'
                        : item.kind === 'kingdom'
                          ? `${item.villages.toLocaleString('cs-CZ')} lén`
                          : `${item.coordX}|${item.coordY}`}
                    </span>
                  </li>
                ))}
                {!autocomplete.loading && autocomplete.items.length === 0 ? (
                  <li>
                    <span>Žádné návrhy</span>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
          <textarea
            ref={(node) => {
              composerRefByThreadId.current[threadId] = node;
            }}
            value={draft}
            onChange={(event) => {
              handleThreadDraftChange(threadId, event.target.value, event.target.selectionStart ?? event.target.value.length);
            }}
            onKeyDown={(event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void sendMessage(threadId, draft);
              }
            }}
            maxLength={MAX_BODY_LENGTH}
            placeholder="Napiš zprávu… (Ctrl+Enter = odeslat)"
          />
          <div className="communication-quick-row">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={`quick-emoji-${threadId}-${emoji}`}
                type="button"
                className="secondary-action"
                onClick={() => sendEmoji(threadId, emoji)}
                title={
                  emoji === '🙂'
                    ? ':)'
                    : emoji === '😄'
                      ? ':D'
                      : emoji === '🔥'
                        ? 'FIRE'
                        : emoji === '⚔️'
                          ? 'FIGHT'
                          : 'SHIELD'
                }
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="communication-chat-actions">
            <button
              type="button"
              className="secondary-action danger"
              onClick={() =>
                setMinimizedThreadIds((previous) => (previous.includes(threadId) ? previous : [...previous, threadId]))
              }
            >
              Minimalizovat
            </button>
            <button
              type="button"
              className="secondary-action communication-send-button"
              onClick={() => {
                void sendMessage(threadId, draft);
              }}
              disabled={isSendPending || !draft.trim()}
            >
              {isSendPending ? 'Odesílám…' : 'Odeslat'}
            </button>
          </div>
        </footer>
      </section>
    );
  };

  const toggleHub = () => {
    setHubOpen((previous) => {
      const next = !previous;
      if (next) {
        setLastOpenedAt(new Date().toISOString());
      }
      return next;
    });
  };

  const handleQuickOpen = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = quickOpenDraft.trim().replace(/^@/, '');
    if (!value) {
      return;
    }
    void openThreadByUsername(value);
  };

  const sortedOpenThreadIds = isMobile
    ? activeThreadId != null && openThreadIds.includes(activeThreadId)
      ? [activeThreadId]
      : []
    : openThreadIds;

  const launchBadgeLabel = badgeCount > 99 ? '99+' : badgeCount;

  return (
    <>
      <button type="button" className={`communication-launcher ${hubOpen ? 'is-open' : ''}`} onClick={toggleHub}>
        <span>Komunikace</span>
        {badgeCount > 0 ? <strong className="communication-launcher-badge">{launchBadgeLabel}</strong> : null}
      </button>

      {hubOpen ? (
        <section className={`communication-hub ${isMobile ? 'is-mobile' : ''}`} aria-label="Komunikace">
          <header className="communication-hub-header">
            <h3>Komunikace</h3>
            <small>
              Nepřečtené {Number(summary.unreadMessages ?? 0).toLocaleString('cs-CZ')} · Žádosti{' '}
              {Number(summary.messageRequests ?? 0).toLocaleString('cs-CZ')} · Přátelství{' '}
              {Number(summary.friendRequests ?? 0).toLocaleString('cs-CZ')}
            </small>
            <div className="communication-row-actions">
              <button type="button" className="secondary-action" onClick={() => setHubOpen(false)}>
                Zavřít
              </button>
            </div>
          </header>

          <div className="communication-tab-row">
            <button
              type="button"
              className={`secondary-action ${tab === 'threads' ? 'is-active' : ''}`}
              onClick={() => setTab('threads')}
            >
              Konverzace
            </button>
            <button
              type="button"
              className={`secondary-action ${tab === 'requests' ? 'is-active' : ''}`}
              onClick={() => setTab('requests')}
            >
              Žádosti
            </button>
            <button
              type="button"
              className={`secondary-action ${tab === 'friends' ? 'is-active' : ''}`}
              onClick={() => setTab('friends')}
            >
              Přátelé
            </button>
            <button
              type="button"
              className={`secondary-action ${tab === 'blocked' ? 'is-active' : ''}`}
              onClick={() => setTab('blocked')}
            >
              Blokovaní
            </button>
          </div>

          <div className="communication-search-row">
            <input
              type="text"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Hledat hráče nebo zprávy..."
              maxLength={40}
            />
            <button
              type="button"
              className="secondary-action"
              onClick={() => setSearchDraft('')}
              disabled={!searchDraft.trim()}
            >
              Smazat
            </button>
          </div>

          {error ? <p className="panel-feedback">{error}</p> : null}

          <div className="communication-panel-grid">
            {tab === 'threads' ? (
              <>
                {filteredThreads.length > 0 ? (
                  <ul className="communication-thread-list">
                    {filteredThreads.map((thread) => {
                      const isOpen = openThreadIds.includes(thread.id);
                      const preview = buildMessagePreview(thread.lastMessage);
                      return (
                        <li key={`thread-row-${thread.id}`}>
                          <button
                            type="button"
                            className={`communication-thread-item relation-${thread.relation} ${isOpen ? 'is-active' : ''}`}
                            onClick={() => {
                              void openThreadById(thread.id);
                            }}
                          >
                            <header>
                              <span className="communication-user-chip">
                                <span className="communication-user-avatar" aria-hidden="true">
                                  {thread.otherPlayer.avatarUrl ? (
                                    <img src={thread.otherPlayer.avatarUrl} alt="" loading="lazy" />
                                  ) : (
                                    getAvatarFallback(thread.otherPlayer.username)
                                  )}
                                </span>
                                <strong>{thread.otherPlayer.username}</strong>
                              </span>
                              <small>{relativeTime(thread.lastActivityAt)}</small>
                            </header>
                            <p>{preview}</p>
                            <footer>
                              <span>{thread.isMessageRequest ? 'Message request' : thread.relation}</span>
                              {thread.unreadCount > 0 ? (
                                <span className="communication-unread-pill">
                                  {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                                </span>
                              ) : null}
                            </footer>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="communication-list-empty">Žádné konverzace pro aktuální filtr.</p>
                )}

                {searchSuggestions.length > 0 ? (
                  <section className="communication-suggestions">
                    <h4>Návrhy hráčů</h4>
                    <ul className="communication-mini-list">
                      {searchSuggestions
                        .filter((item) => item.kind === 'user')
                        .map((item) => (
                          <li key={`search-suggestion-${item.value}`}>
                            <div>
                              <span className="communication-user-chip">
                                <span className="communication-user-avatar tiny" aria-hidden="true">
                                  {'avatarUrl' in item && item.avatarUrl ? (
                                    <img src={item.avatarUrl} alt="" loading="lazy" />
                                  ) : (
                                    getAvatarFallback(item.label)
                                  )}
                                </span>
                                <strong>{getSuggestionLabel(item)}</strong>
                              </span>
                            </div>
                            <div className="communication-row-actions">
                              <button
                                type="button"
                                className="secondary-action"
                                onClick={() => {
                                  void openThreadByUsername(item.label);
                                }}
                              >
                                Otevřít chat
                              </button>
                              <button
                                type="button"
                                className="secondary-action"
                                onClick={() => {
                                  void handleSendFriendRequest(item.label);
                                }}
                                disabled={friendByUsername.has(item.label.toLocaleLowerCase('cs-CZ'))}
                              >
                                Přidat přítele
                              </button>
                            </div>
                          </li>
                        ))}
                    </ul>
                  </section>
                ) : null}
              </>
            ) : null}

            {tab === 'requests' ? (
              <>
                <section>
                  <h4>Message requesty</h4>
                  {messageRequestThreads.length > 0 ? (
                    <ul className="communication-mini-list">
                      {messageRequestThreads.map((thread) => (
                        <li key={`request-thread-${thread.id}`}>
                          <div>
                            <span className="communication-user-chip">
                              <span className="communication-user-avatar tiny" aria-hidden="true">
                                {thread.otherPlayer.avatarUrl ? (
                                  <img src={thread.otherPlayer.avatarUrl} alt="" loading="lazy" />
                                ) : (
                                  getAvatarFallback(thread.otherPlayer.username)
                                )}
                              </span>
                              <strong>{thread.otherPlayer.username}</strong>
                            </span>
                            <small>{relativeTime(thread.lastActivityAt)}</small>
                          </div>
                          <div className="communication-row-actions">
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() => {
                                void openThreadById(thread.id);
                              }}
                            >
                              Otevřít
                            </button>
                            <button
                              type="button"
                              className="secondary-action danger"
                              onClick={() => {
                                void handleArchiveThread(thread.id);
                              }}
                            >
                              Archivovat
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="communication-list-empty">Žádné message requesty.</p>
                  )}
                </section>

                <section>
                  <h4>Příchozí žádosti o přátelství</h4>
                  {inbox?.friendRequests?.incoming?.length ? (
                    <ul className="communication-mini-list">
                      {inbox.friendRequests.incoming.map((request) => (
                        <li key={`friend-request-incoming-${request.id}`}>
                          <div>
                            <span className="communication-user-chip">
                              <span className="communication-user-avatar tiny" aria-hidden="true">
                                {request.senderAvatarUrl ? (
                                  <img src={request.senderAvatarUrl} alt="" loading="lazy" />
                                ) : (
                                  getAvatarFallback(request.senderUsername)
                                )}
                              </span>
                              <strong>{request.senderUsername}</strong>
                            </span>
                            <small>{relativeTime(request.createdAt)}</small>
                          </div>
                          <div className="communication-row-actions">
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() => {
                                void handleFriendRequestResponse(request.id, 'accept');
                              }}
                              disabled={actionKey === `friend-request-${request.id}-accept`}
                            >
                              Přijmout
                            </button>
                            <button
                              type="button"
                              className="secondary-action danger"
                              onClick={() => {
                                void handleFriendRequestResponse(request.id, 'reject');
                              }}
                              disabled={actionKey === `friend-request-${request.id}-reject`}
                            >
                              Odmítnout
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="communication-list-empty">Nemáš nové žádosti.</p>
                  )}
                </section>

                <section>
                  <h4>Odeslané žádosti</h4>
                  {inbox?.friendRequests?.outgoing?.length ? (
                    <ul className="communication-mini-list">
                      {inbox.friendRequests.outgoing.map((request) => (
                        <li key={`friend-request-outgoing-${request.id}`}>
                          <div>
                            <strong>{request.receiverUsername}</strong>
                            <small>{relativeTime(request.createdAt)}</small>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="communication-list-empty">Nemáš čekající odeslané žádosti.</p>
                  )}
                </section>
              </>
            ) : null}

            {tab === 'friends' ? (
              <section>
                <h4>Seznam přátel</h4>
                {inbox?.friends?.length ? (
                  <ul className="communication-mini-list">
                    {inbox.friends.map((friend) => (
                      <li key={`friend-${friend.playerId}`}>
                        <div>
                          <span className="communication-user-chip">
                            <span className="communication-user-avatar tiny" aria-hidden="true">
                              {friend.avatarUrl ? (
                                <img src={friend.avatarUrl} alt="" loading="lazy" />
                              ) : (
                                getAvatarFallback(friend.username)
                              )}
                            </span>
                            <strong>{friend.username}</strong>
                          </span>
                          <small>{friend.isOnline ? 'Online' : relativeTime(friend.lastActiveAt)}</small>
                        </div>
                        <div className="communication-row-actions">
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() => {
                              void openThreadByUsername(friend.username);
                            }}
                          >
                            Napsat
                          </button>
                          <button
                            type="button"
                            className="secondary-action danger"
                            onClick={() => {
                              void handleRemoveFriend(friend.username);
                            }}
                          >
                            Odebrat
                          </button>
                          <button
                            type="button"
                            className="secondary-action danger"
                            onClick={() => {
                              void handleBlock(friend.username);
                            }}
                          >
                            Blokovat
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="communication-list-empty">Zatím nemáš žádné přátele.</p>
                )}
              </section>
            ) : null}

            {tab === 'blocked' ? (
              <section>
                <h4>Blokovaní hráči</h4>
                {inbox?.blockedPlayers?.length ? (
                  <ul className="communication-mini-list">
                    {inbox.blockedPlayers.map((blocked) => (
                      <li key={`blocked-${blocked.playerId}`}>
                        <div>
                          <strong>{blocked.username}</strong>
                        </div>
                        <div className="communication-row-actions">
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() => {
                              void handleUnblock(blocked.username);
                            }}
                          >
                            Odblokovat
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="communication-list-empty">Nemáš blokované hráče.</p>
                )}
              </section>
            ) : null}
          </div>

          <footer className="communication-hub-footer">
            <form className="communication-inline-form" onSubmit={handleQuickOpen}>
              <input
                type="text"
                value={quickOpenDraft}
                onChange={(event) => setQuickOpenDraft(event.target.value)}
                placeholder="@nick hráče"
                maxLength={32}
              />
              <button type="submit" className="secondary-action">
                Otevřít chat
              </button>
            </form>
          </footer>
        </section>
      ) : null}

      {sortedOpenThreadIds.length > 0 ? (
        <div className={`communication-chat-dock ${hubOpen && !isMobile ? 'with-hub' : ''}`} aria-live="polite">
          {sortedOpenThreadIds.map((threadId) => renderChatThread(threadId))}
        </div>
      ) : null}
    </>
  );
};
