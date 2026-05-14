import {
  type ClipboardEvent as ReactClipboardEvent,
  type ChangeEvent,
  type FormEvent,
  type JSX,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ImagePlus, LoaderCircle, Pin, Plus, Send, Square, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type {
  AgentChatApi,
  AgentChatAttachment,
  AgentChatChangedFilesSummary,
  AgentChatContextManifest,
  AgentChatDiagnostic,
  AgentChatEvent,
  AgentChatHost,
  AgentChatMessage,
  AgentChatSession,
} from '../../../shared/agentChat';
import type { AppText, AppTextKey } from '../i18n/appLanguage';
import { COMPONENT_IDS } from '../componentIds';

interface AgentChatPanelProps {
  readonly api: AgentChatApi;
  readonly contextManifest: AgentChatContextManifest;
  readonly host?: AgentChatHost;
  readonly onClose: () => void;
  readonly text: AppText;
  readonly workspaceRoot: string;
}

const upsertSession = (
  sessions: readonly AgentChatSession[],
  session: AgentChatSession,
): readonly AgentChatSession[] =>
  sessions.some((item) => item.sessionId === session.sessionId)
    ? sessions.map((item) =>
        item.sessionId === session.sessionId ? session : item,
      )
    : [session, ...sessions];

const upsertMessage = (
  messages: readonly AgentChatMessage[],
  message: AgentChatMessage,
): readonly AgentChatMessage[] =>
  messages.some((item) => item.messageId === message.messageId)
    ? messages.map((item) =>
        item.messageId === message.messageId ? message : item,
      )
    : [...messages, message];

const appendAssistantDelta = (
  messages: readonly AgentChatMessage[],
  event: Extract<AgentChatEvent, { type: 'assistant-message-delta' }>,
): readonly AgentChatMessage[] => {
  const existingMessage = messages.find(
    (message) => message.messageId === event.messageId,
  );

  if (!existingMessage) {
    return [
      ...messages,
      {
        attachments: [],
        content: event.delta,
        createdAt: event.createdAt,
        messageId: event.messageId,
        role: 'assistant',
        sessionId: event.sessionId,
      },
    ];
  }

  return messages.map((message) =>
    message.messageId === event.messageId
      ? {
          ...message,
          content: `${message.content}${event.delta}`,
        }
      : message,
  );
};

const isImageFile = (file: File): boolean => file.type.startsWith('image/');

const readFileBytes = async (file: File): Promise<Uint8Array> => {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }

  return new Uint8Array(
    await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        reject(reader.error ?? new Error('Unable to read attachment'));
      };
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
          return;
        }

        reject(new Error('Unable to read attachment'));
      };
      reader.readAsArrayBuffer(file);
    }),
  );
};

const getClipboardFiles = (
  clipboardData: DataTransfer,
): readonly File[] => {
  const getFileKey = (file: File): string =>
    [file.name, file.type, file.size, file.lastModified].join('\u0000');

  const directFiles = Array.from(clipboardData.files);
  const seenFileKeys = new Set(directFiles.map(getFileKey));
  const itemFiles = Array.from(clipboardData.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null)
    .filter((file) => {
      const fileKey = getFileKey(file);

      if (seenFileKeys.has(fileKey)) {
        return false;
      }

      seenFileKeys.add(fileKey);
      return true;
    });

  return [...directFiles, ...itemFiles];
};

const createSessionLabel = (
  session: AgentChatSession,
  text: AppText,
): string => {
  const title = session.title?.trim();

  if (title) {
    return title;
  }

  return text('agentChat.untitledSession');
};

const getChangeTypeLabelKey = (
  changeType: 'added' | 'deleted' | 'modified',
): AppTextKey => {
  if (changeType === 'added') {
    return 'agentChat.changeTypeAdded';
  }

  if (changeType === 'deleted') {
    return 'agentChat.changeTypeDeleted';
  }

  return 'agentChat.changeTypeModified';
};

const getMessageRoleNameKey = (
  role: AgentChatMessage['role'],
): AppTextKey => {
  if (role === 'thinking') {
    return 'agentChat.thinking';
  }

  if (role === 'user') {
    return 'agentChat.userName';
  }

  if (role === 'system') {
    return 'agentChat.systemName';
  }

  return 'agentChat.assistantName';
};

const getMessageRoleAvatarKey = (
  role: AgentChatMessage['role'],
): AppTextKey => {
  if (role === 'thinking') {
    return 'agentChat.assistantAvatar';
  }

  if (role === 'user') {
    return 'agentChat.userAvatar';
  }

  if (role === 'system') {
    return 'agentChat.systemAvatar';
  }

  return 'agentChat.assistantAvatar';
};

const AgentChatMarkdownContent = ({
  content,
}: {
  readonly content: string;
}): JSX.Element => (
  <div className="agent-chat-markdown">
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
      {content}
    </ReactMarkdown>
  </div>
);

type AgentChatContextItemId = 'document' | 'selection';

type AgentChatEnabledContextItems = Readonly<Record<AgentChatContextItemId, boolean>>;

interface AgentChatPinnedSelectionState {
  readonly scopeKey: string;
  readonly selections: readonly string[];
}

const DEFAULT_ENABLED_CONTEXT_ITEMS: AgentChatEnabledContextItems = {
  document: true,
  selection: true,
};
const EMPTY_PINNED_SELECTIONS: readonly string[] = [];

const trimSelectionParts = (
  parts: readonly string[],
): readonly string[] =>
  Array.from(
    new Set(
      parts
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
    ),
  );

const createSendContextManifest = (input: {
  readonly contextManifest: AgentChatContextManifest;
  readonly enabledContextItems: AgentChatEnabledContextItems;
  readonly pinnedSelections: readonly string[];
}): AgentChatContextManifest => {
  const baseManifest = input.enabledContextItems.document
    ? input.contextManifest
    : {
        ...(input.contextManifest.modelName
          ? { modelName: input.contextManifest.modelName }
          : {}),
        currentDocumentSnapshot: input.contextManifest.currentDocumentSnapshot,
        permissionMode: input.contextManifest.permissionMode,
        selectedBlockIds: input.contextManifest.selectedBlockIds,
        selectedText: input.contextManifest.selectedText,
        sessionPurpose: input.contextManifest.sessionPurpose,
        workspaceRoot: input.contextManifest.workspaceRoot,
      };
  const selectionParts = input.enabledContextItems.selection
    ? trimSelectionParts([
        ...input.pinnedSelections,
        input.contextManifest.selectedText,
      ])
    : [];

  return {
    ...baseManifest,
    currentDocumentSnapshot: input.enabledContextItems.document
      ? input.contextManifest.currentDocumentSnapshot
      : '',
    selectedBlockIds: input.enabledContextItems.selection
      ? input.contextManifest.selectedBlockIds
      : [],
    selectedText: selectionParts.join('\n\n'),
  };
};

export function AgentChatPanel({
  api,
  contextManifest,
  host = 'editor',
  onClose,
  text,
  workspaceRoot,
}: AgentChatPanelProps): JSX.Element {
  const [sessions, setSessions] = useState<readonly AgentChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<readonly AgentChatMessage[]>([]);
  const [composerValue, setComposerValue] = useState('');
  const [attachments, setAttachments] = useState<readonly AgentChatAttachment[]>(
    [],
  );
  const [changedFilesBySession, setChangedFilesBySession] = useState<
    Readonly<Record<string, AgentChatChangedFilesSummary>>
  >({});
  const [enabledContextItems, setEnabledContextItems] =
    useState<AgentChatEnabledContextItems>(DEFAULT_ENABLED_CONTEXT_ITEMS);
  const [pinnedSelectionState, setPinnedSelectionState] =
    useState<AgentChatPinnedSelectionState>({
      scopeKey: '',
      selections: [],
    });
  const [diagnosticMessage, setDiagnosticMessage] = useState<string | null>(null);
  const [pendingSendSessionIds, setPendingSendSessionIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resumedSessionIdsRef = useRef<Set<string>>(new Set());
  const showGenericDiagnostic = useCallback(() => {
    setDiagnosticMessage(text('agentChat.diagnostic'));
  }, [text]);
  const showDiagnostic = useCallback(
    (diagnostic?: Pick<AgentChatDiagnostic, 'code'>) => {
      if (diagnostic?.code === 'turn-failed') {
        setDiagnosticMessage(text('agentChat.turnFailed'));
        return;
      }

      showGenericDiagnostic();
    },
    [showGenericDiagnostic, text],
  );

  const activeSession = useMemo(
    () =>
      activeSessionId
        ? sessions.find((session) => session.sessionId === activeSessionId) ??
          null
        : null,
    [activeSessionId, sessions],
  );
  const visibleMessages = useMemo(
    () =>
      activeSessionId
        ? messages.filter((message) => message.sessionId === activeSessionId)
        : [],
    [activeSessionId, messages],
  );
  const changedFilesSummary =
    activeSessionId ? changedFilesBySession[activeSessionId] : undefined;
  const isActiveSessionSending =
    activeSessionId !== null && pendingSendSessionIds.has(activeSessionId);
  const canStopActiveSession = Boolean(activeSession?.nativeSessionId);
  const currentSelectionText = contextManifest.selectedText.trim();
  const pinnedSelectionScopeKey = [
    contextManifest.workspaceRoot,
    contextManifest.currentDocumentPath ?? '',
  ].join('\u0000');
  const pinnedSelections = useMemo(
    () =>
      pinnedSelectionState.scopeKey === pinnedSelectionScopeKey
        ? pinnedSelectionState.selections
        : EMPTY_PINNED_SELECTIONS,
    [pinnedSelectionScopeKey, pinnedSelectionState],
  );
  const sendContextManifest = useMemo(
    () =>
      createSendContextManifest({
        contextManifest,
        enabledContextItems,
        pinnedSelections,
      }),
    [contextManifest, enabledContextItems, pinnedSelections],
  );

  useEffect(() => {
    let isMounted = true;

    void api
      .listSessions({
        selectedEngineId: 'codex',
        workspaceRoot,
      })
      .then((loadedSessions) => {
        if (!isMounted) {
          return;
        }

        setSessions(loadedSessions);
        setActiveSessionId(
          (currentSessionId) =>
            currentSessionId ?? loadedSessions[0]?.sessionId ?? null,
        );
      })
      .catch(() => {
        if (isMounted) {
          showGenericDiagnostic();
        }
      });

    return () => {
      isMounted = false;
    };
  }, [api, showGenericDiagnostic, workspaceRoot]);

  useEffect(
    () =>
      api.onEvent((event) => {
        if ('session' in event && event.session.workspaceRoot !== workspaceRoot) {
          return;
        }

        if ('session' in event) {
          setSessions((currentSessions) =>
            upsertSession(currentSessions, event.session),
          );
          if (event.session.nativeSessionId) {
            resumedSessionIdsRef.current.add(event.session.sessionId);
          }
          setActiveSessionId((currentSessionId) =>
            currentSessionId ?? event.session.sessionId,
          );
          if (event.type === 'session-failed') {
            showDiagnostic(event.diagnostic);
          }
          return;
        }

        if (event.type === 'message-created') {
          setMessages((currentMessages) =>
            upsertMessage(currentMessages, event.message),
          );
          return;
        }

        if (event.type === 'assistant-message-delta') {
          setMessages((currentMessages) =>
            appendAssistantDelta(currentMessages, event),
          );
          return;
        }

        if (event.type === 'assistant-message-completed') {
          setMessages((currentMessages) =>
            upsertMessage(currentMessages, event.message),
          );
          return;
        }

        if (event.type === 'thinking-updated') {
          setMessages((currentMessages) =>
            upsertMessage(currentMessages, event.message),
          );
          return;
        }

        if (event.type === 'changed-files-updated') {
          setChangedFilesBySession((currentSummaries) => ({
            ...currentSummaries,
            [event.sessionId]: event.summary,
          }));
          return;
        }

        if (event.type === 'diagnostic') {
          if (
            event.diagnostic.code === 'changed-files-unavailable' &&
            event.diagnostic.recoverable
          ) {
            return;
          }
          showDiagnostic(event.diagnostic);
        }
      }),
    [api, showDiagnostic, workspaceRoot],
  );

  useEffect(
    () => () => {
      void api
        .releaseWorkspaceSubscriptions({ workspaceRoot })
        .catch(() => undefined);
    },
    [api, workspaceRoot],
  );

  useEffect(() => {
    if (
      !activeSession?.nativeSessionId ||
      activeSession.state === 'draft' ||
      activeSession.state === 'native-starting' ||
      resumedSessionIdsRef.current.has(activeSession.sessionId)
    ) {
      return;
    }

    let isMounted = true;
    resumedSessionIdsRef.current.add(activeSession.sessionId);

    void api
      .resumeSession({
        nativeSessionId: activeSession.nativeSessionId,
        sessionId: activeSession.sessionId,
        workspaceRoot,
      })
      .then((session) => {
        if (!isMounted) {
          return;
        }
        setSessions((currentSessions) => upsertSession(currentSessions, session));
        setActiveSessionId(session.sessionId);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        resumedSessionIdsRef.current.delete(activeSession.sessionId);
        showGenericDiagnostic();
      });

    return () => {
      isMounted = false;
    };
  }, [activeSession, api, showGenericDiagnostic, workspaceRoot]);

  const createDraftSession = useCallback(async (): Promise<AgentChatSession> => {
    const session = await api.createDraftSession({
      engineId: 'codex',
      host,
      sessionPurpose: contextManifest.sessionPurpose,
      workspaceRoot,
    });

    setSessions((currentSessions) => upsertSession(currentSessions, session));
    setActiveSessionId(session.sessionId);

    return session;
  }, [api, contextManifest.sessionPurpose, host, workspaceRoot]);

  const ensureActiveSession = useCallback(async (): Promise<AgentChatSession> => {
    if (activeSession) {
      return activeSession;
    }

    return createDraftSession();
  }, [activeSession, createDraftSession]);

  const toggleContextItem = (
    itemId: AgentChatContextItemId,
    enabled: boolean,
  ): void => {
    setEnabledContextItems((currentItems) => ({
      ...currentItems,
      [itemId]: enabled,
    }));
  };

  const pinCurrentSelection = (): void => {
    if (!currentSelectionText) {
      return;
    }

    setEnabledContextItems((currentItems) => ({
      ...currentItems,
      selection: true,
    }));
    setPinnedSelectionState((currentState) => {
      const currentSelections =
        currentState.scopeKey === pinnedSelectionScopeKey
          ? currentState.selections
          : [];

      return {
        scopeKey: pinnedSelectionScopeKey,
        selections: currentSelections.includes(currentSelectionText)
          ? currentSelections
          : [...currentSelections, currentSelectionText],
      };
    });
  };

  const saveImageFiles = useCallback(
    async (files: readonly File[]): Promise<void> => {
      const imageFiles = files.filter(isImageFile);

      if (imageFiles.length === 0) {
        return;
      }

      const session = await ensureActiveSession();
      const savedAttachments = await Promise.all(
        imageFiles.map(async (file) =>
          api.saveAttachment({
            bytes: await readFileBytes(file),
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            sessionId: session.sessionId,
            workspaceRoot,
          }),
        ),
      );

      setAttachments((currentAttachments) => [
        ...currentAttachments,
        ...savedAttachments,
      ]);
    },
    [api, ensureActiveSession, workspaceRoot],
  );

  const pasteImages = (event: ReactClipboardEvent<HTMLTextAreaElement>): void => {
    const files = getClipboardFiles(event.clipboardData);

    if (files.some(isImageFile)) {
      event.preventDefault();
      void saveImageFiles(files);
    }
  };

  const attachSelectedImages = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    void saveImageFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const trimmedMessage = composerValue.trim();

    if (!trimmedMessage) {
      return;
    }

    const session = await ensureActiveSession();
    const messageAttachments = attachments;
    const submittedMessage = trimmedMessage;
    const submittedAttachments = messageAttachments;

    setComposerValue('');
    setAttachments([]);
    setDiagnosticMessage(null);
    setPendingSendSessionIds(
      (currentSessionIds) => new Set([...currentSessionIds, session.sessionId]),
    );

    try {
      await api.sendMessage({
        attachments: messageAttachments,
        content: submittedMessage,
        contextManifest: sendContextManifest,
        modelName: sendContextManifest.modelName,
        sessionId: session.sessionId,
        workspaceRoot,
      });
    } catch {
      setComposerValue((currentValue) =>
        currentValue.trim() ? currentValue : submittedMessage,
      );
      setAttachments((currentAttachments) =>
        currentAttachments.length > 0 ? currentAttachments : submittedAttachments,
      );
      showDiagnostic({ code: 'turn-failed' });
    } finally {
      setPendingSendSessionIds((currentSessionIds) => {
        const nextSessionIds = new Set(currentSessionIds);
        nextSessionIds.delete(session.sessionId);
        return nextSessionIds;
      });
    }
  };

  const stopSession = async (): Promise<void> => {
    if (!activeSession?.nativeSessionId) {
      return;
    }

    await api.stopSession({
      sessionId: activeSession.sessionId,
      workspaceRoot,
    });
  };

  return (
    <aside
      aria-label={text('agentChat.title')}
      className="agent-chat-panel"
      data-component-id={COMPONENT_IDS.agentChat.panel}
    >
      <header className="agent-chat-header">
        <div className="agent-chat-session-stack">
          <select
            aria-label={text('agentChat.session')}
            className="agent-chat-session-picker"
            data-component-id={COMPONENT_IDS.agentChat.sessionPicker}
            id="agent-chat-session-picker"
            onChange={(event) => {
              setActiveSessionId(event.target.value || null);
            }}
            value={activeSessionId ?? ''}
          >
            {sessions.length === 0 ? (
              <option value="">{text('agentChat.untitledSession')}</option>
            ) : null}
            {sessions.map((session) => (
              <option key={session.sessionId} value={session.sessionId}>
                {createSessionLabel(session, text)}
              </option>
            ))}
          </select>
        </div>
        <div className="agent-chat-session-controls">
          <button
            aria-label={text('agentChat.newSession')}
            className="agent-chat-icon-button"
            data-component-id={COMPONENT_IDS.agentChat.newSessionButton}
            onClick={() => {
              void createDraftSession();
            }}
            title={text('agentChat.newSession')}
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
          </button>
          <button
            aria-label={text('agentChat.close')}
            className="agent-chat-icon-button"
            data-component-id={COMPONENT_IDS.agentChat.closeButton}
            onClick={onClose}
            title={text('agentChat.close')}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      </header>

      <section
        aria-live="polite"
        className="agent-chat-body"
      >
        <div
          className="agent-chat-message-list"
          data-component-id={COMPONENT_IDS.agentChat.messageList}
        >
          {visibleMessages.length > 0 ? (
            visibleMessages.map((message) => (
              <article
                className={`agent-chat-message is-${message.role}`}
                data-component-id={COMPONENT_IDS.agentChat.messageItem}
                key={message.messageId}
              >
                <span
                  aria-hidden="true"
                  className={`agent-chat-avatar is-${message.role}`}
                >
                  {text(getMessageRoleAvatarKey(message.role))}
                </span>
                <div className="agent-chat-bubble">
                  {message.role === 'thinking' ? (
                    <details
                      className="agent-chat-thinking-details"
                      open={message.isStreaming ? true : undefined}
                    >
                      <summary>
                        {message.isStreaming ? (
                          <LoaderCircle aria-hidden="true" size={14} />
                        ) : null}
                        <span>{text('agentChat.thinking')}</span>
                      </summary>
                      <div className="agent-chat-bubble-content">
                        <AgentChatMarkdownContent content={message.content} />
                      </div>
                    </details>
                  ) : (
                    <>
                      <div className="agent-chat-bubble-head">
                        <strong>{text(getMessageRoleNameKey(message.role))}</strong>
                      </div>
                      <div className="agent-chat-bubble-content">
                        <AgentChatMarkdownContent content={message.content} />
                      </div>
                    </>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p className="agent-chat-empty">{text('agentChat.noMessages')}</p>
          )}
          {isActiveSessionSending ? (
            <article className="agent-chat-message is-assistant is-streaming">
              <span aria-hidden="true" className="agent-chat-avatar is-assistant">
                {text('agentChat.assistantAvatar')}
              </span>
              <div className="agent-chat-bubble">
                <div className="agent-chat-bubble-head">
                  <strong>{text('agentChat.assistantName')}</strong>
                </div>
                <div className="agent-chat-bubble-content is-stream">
                  <p
                    className="agent-chat-thinking"
                    data-component-id={COMPONENT_IDS.agentChat.thinkingStatus}
                    role="status"
                  >
                    <LoaderCircle aria-hidden="true" size={14} />
                    <span>{text('agentChat.thinking')}</span>
                  </p>
                </div>
              </div>
            </article>
          ) : null}
        </div>

        {changedFilesSummary?.available &&
        changedFilesSummary.files.length > 0 ? (
          <section
            className="agent-chat-changed-files"
            data-component-id={COMPONENT_IDS.agentChat.changedFiles}
          >
            <header>
              <h3>{text('agentChat.changedFiles')}</h3>
            </header>
            <ul>
              {changedFilesSummary.files.map((file) => (
                <li
                  data-component-id={COMPONENT_IDS.agentChat.changedFileRow}
                  key={`${file.changeType}:${file.path}`}
                >
                  <span>{text(getChangeTypeLabelKey(file.changeType))}</span>
                  <strong>{file.path}</strong>
                </li>
              ))}
            </ul>
          </section>
        ) : changedFilesSummary?.available === false ? (
          <section
            className="agent-chat-changed-files"
            data-component-id={COMPONENT_IDS.agentChat.changedFiles}
          >
            <header>
              <h3>{text('agentChat.changedFiles')}</h3>
            </header>
            <p className="agent-chat-changed-files-note">
              {text('agentChat.changedFilesUnavailable')}
            </p>
          </section>
        ) : null}
      </section>

      {diagnosticMessage ? (
        <p className="agent-chat-diagnostic" role="alert">
          {diagnosticMessage}
        </p>
      ) : null}

      <form
        className="agent-chat-composer"
        data-component-id={COMPONENT_IDS.agentChat.composer}
        onSubmit={(event) => {
          void sendMessage(event);
        }}
      >
        <details
          className="agent-chat-context-preview"
          data-component-id={COMPONENT_IDS.agentChat.contextPreview}
        >
          <summary>
            <span>{text('agentChat.contextAndPermission')}</span>
            <span>{text('agentChat.contextSummary')}</span>
          </summary>
          <div className="agent-chat-context-grid">
            <div className="agent-chat-context-item">
              <span>{text('agentChat.workspace')}</span>
              <strong>{contextManifest.workspaceRoot}</strong>
            </div>
            <div className="agent-chat-context-item">
              <label className="agent-chat-context-toggle">
                <input
                  aria-label={text('agentChat.includeDocumentContext')}
                  checked={enabledContextItems.document}
                  data-component-id={COMPONENT_IDS.agentChat.contextDocumentToggle}
                  onChange={(event) => {
                    toggleContextItem('document', event.target.checked);
                  }}
                  type="checkbox"
                />
                <span>{text('agentChat.document')}</span>
              </label>
              <strong className="agent-chat-context-value">
                {contextManifest.currentDocumentPath ??
                  text('agentChat.noDocument')}
              </strong>
            </div>
            <div className="agent-chat-context-item">
              <label className="agent-chat-context-toggle">
                <input
                  aria-label={text('agentChat.includeSelectionContext')}
                  checked={enabledContextItems.selection}
                  data-component-id={COMPONENT_IDS.agentChat.contextSelectionToggle}
                  onChange={(event) => {
                    toggleContextItem('selection', event.target.checked);
                  }}
                  type="checkbox"
                />
                <span>{text('agentChat.selection')}</span>
              </label>
              <div className="agent-chat-context-value-row">
                <strong className="agent-chat-context-value">
                  {currentSelectionText || text('agentChat.noSelection')}
                </strong>
                <button
                  aria-label={text('agentChat.pinSelection')}
                  className="agent-chat-pin-button"
                  data-component-id={
                    COMPONENT_IDS.agentChat.contextSelectionPinButton
                  }
                  disabled={!currentSelectionText}
                  onClick={pinCurrentSelection}
                  title={text('agentChat.pinSelection')}
                  type="button"
                >
                  <Pin aria-hidden="true" size={13} />
                </button>
              </div>
              {pinnedSelections.length > 0 ? (
                <ul className="agent-chat-pinned-selections">
                  {pinnedSelections.map((selection, index) => (
                    <li key={`${index}:${selection}`}>
                      <span>{selection}</span>
                      <button
                        aria-label={text('agentChat.removePinnedSelection', {
                          index: index + 1,
                        })}
                        data-component-id={
                          COMPONENT_IDS.agentChat.pinnedSelectionRemoveButton
                        }
                        onClick={() => {
                          setPinnedSelectionState((currentState) => ({
                            scopeKey: pinnedSelectionScopeKey,
                            selections: (
                              currentState.scopeKey === pinnedSelectionScopeKey
                                ? currentState.selections
                                : []
                            ).filter(
                              (_selection, selectionIndex) => selectionIndex !== index,
                            ),
                          }));
                        }}
                        type="button"
                      >
                        <X aria-hidden="true" size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="agent-chat-context-item">
              <span>{text('agentChat.permission')}</span>
              <strong>{text('agentChat.maxPermission')}</strong>
            </div>
          </div>
        </details>
        <div
          className="agent-chat-message-box"
          data-component-id={COMPONENT_IDS.agentChat.messageBox}
        >
          {attachments.length > 0 ? (
            <div className="agent-chat-attachments">
              {attachments.map((attachment) => (
                <div
                  className="agent-chat-attachment-chip"
                  data-component-id={COMPONENT_IDS.agentChat.attachmentChip}
                  key={attachment.attachmentId}
                >
                  <span className="agent-chat-attachment-meta">
                    <span aria-hidden="true" className="agent-chat-attachment-mini" />
                    <span>
                      <strong>{attachment.fileName}</strong>
                      <span>{attachment.mimeType}</span>
                    </span>
                  </span>
                  <button
                    aria-label={text('agentChat.removeAttachment', {
                      fileName: attachment.fileName,
                    })}
                    data-component-id={COMPONENT_IDS.agentChat.attachmentRemoveButton}
                    onClick={() => {
                      setAttachments((currentAttachments) =>
                        currentAttachments.filter(
                          (item) =>
                            item.attachmentId !== attachment.attachmentId,
                        ),
                      );
                    }}
                    type="button"
                  >
                    <X aria-hidden="true" size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <textarea
            aria-label={text('agentChat.messageField')}
            data-component-id={COMPONENT_IDS.agentChat.messageField}
            onChange={(event) => {
              setComposerValue(event.target.value);
            }}
            onPaste={pasteImages}
            placeholder={text('agentChat.composerPlaceholder')}
            rows={3}
            value={composerValue}
          />
          <div className="agent-chat-message-box-actions">
            <button
              aria-label={text('agentChat.attachImage')}
              className="agent-chat-icon-button"
              data-component-id={COMPONENT_IDS.agentChat.attachImageButton}
              onClick={() => {
                fileInputRef.current?.click();
              }}
              title={text('agentChat.attachImage')}
              type="button"
            >
              <ImagePlus aria-hidden="true" size={16} />
            </button>
            <input
              accept="image/*"
              className="agent-chat-hidden-input"
              multiple
              onChange={attachSelectedImages}
              ref={fileInputRef}
              type="file"
            />
            <button
              className="agent-chat-send-button"
              data-component-id={COMPONENT_IDS.agentChat.sendButton}
              disabled={isActiveSessionSending && !canStopActiveSession}
              onClick={
                isActiveSessionSending && canStopActiveSession
                  ? () => {
                      void stopSession();
                    }
                  : undefined
              }
              title={
                isActiveSessionSending
                  ? text('agentChat.stop')
                  : text('agentChat.send')
              }
              type={isActiveSessionSending ? 'button' : 'submit'}
            >
              {isActiveSessionSending ? (
                <Square aria-hidden="true" size={14} />
              ) : (
                <Send aria-hidden="true" size={15} />
              )}
              <span>
                {isActiveSessionSending
                  ? text('agentChat.stop')
                  : text('agentChat.send')}
              </span>
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}
