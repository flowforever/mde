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
import { ImagePlus, LoaderCircle, Plus, Send, Square, X } from 'lucide-react';

import type {
  AgentChatApi,
  AgentChatAttachment,
  AgentChatChangedFilesSummary,
  AgentChatContextManifest,
  AgentChatEvent,
  AgentChatMessage,
  AgentChatSession,
} from '../../../shared/agentChat';
import type { AppText, AppTextKey } from '../i18n/appLanguage';
import { COMPONENT_IDS } from '../componentIds';

interface AgentChatPanelProps {
  readonly api: AgentChatApi;
  readonly contextManifest: AgentChatContextManifest;
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

  const suffix = session.nativeSessionId ?? session.sessionId;

  return `${text('agentChat.session')} ${suffix.slice(-8)}`;
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

export function AgentChatPanel({
  api,
  contextManifest,
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
  const [diagnosticMessage, setDiagnosticMessage] = useState<string | null>(null);
  const [pendingSendSessionIds, setPendingSendSessionIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resumedSessionIdsRef = useRef<Set<string>>(new Set());
  const showGenericDiagnostic = useCallback(() => {
    setDiagnosticMessage(text('agentChat.diagnostic'));
  }, [text]);

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
          showGenericDiagnostic();
        }
      }),
    [api, showGenericDiagnostic],
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
      host: 'editor',
      sessionPurpose: contextManifest.sessionPurpose,
      workspaceRoot,
    });

    setSessions((currentSessions) => upsertSession(currentSessions, session));
    setActiveSessionId(session.sessionId);

    return session;
  }, [api, contextManifest.sessionPurpose, workspaceRoot]);

  const ensureActiveSession = useCallback(async (): Promise<AgentChatSession> => {
    if (activeSession) {
      return activeSession;
    }

    return createDraftSession();
  }, [activeSession, createDraftSession]);

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

    setComposerValue('');
    setAttachments([]);
    setDiagnosticMessage(null);
    setPendingSendSessionIds(
      (currentSessionIds) => new Set([...currentSessionIds, session.sessionId]),
    );

    try {
      await api.sendMessage({
        attachments: messageAttachments,
        content: trimmedMessage,
        contextManifest,
        modelName: contextManifest.modelName,
        sessionId: session.sessionId,
        workspaceRoot,
      });
    } catch {
      showGenericDiagnostic();
    } finally {
      setPendingSendSessionIds((currentSessionIds) => {
        const nextSessionIds = new Set(currentSessionIds);
        nextSessionIds.delete(session.sessionId);
        return nextSessionIds;
      });
    }
  };

  const stopSession = async (): Promise<void> => {
    if (!activeSession) {
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
        <div>
          <h2>{text('agentChat.title')}</h2>
        </div>
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
      </header>

      <div className="agent-chat-session-row">
        <select
          aria-label={text('agentChat.session')}
          className="agent-chat-session-picker"
          data-component-id={COMPONENT_IDS.agentChat.sessionPicker}
          onChange={(event) => {
            setActiveSessionId(event.target.value || null);
          }}
          value={activeSessionId ?? ''}
        >
          {sessions.length === 0 ? (
            <option value="">{text('agentChat.session')}</option>
          ) : null}
          {sessions.map((session) => (
            <option key={session.sessionId} value={session.sessionId}>
              {createSessionLabel(session, text)}
            </option>
          ))}
        </select>
        <button
          className="agent-chat-icon-button"
          data-component-id={COMPONENT_IDS.agentChat.newSessionButton}
          onClick={() => {
            void createDraftSession();
          }}
          title={text('agentChat.newSession')}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
          <span>{text('agentChat.newSession')}</span>
        </button>
      </div>

      <section
        className="agent-chat-context-preview"
        data-component-id={COMPONENT_IDS.agentChat.contextPreview}
      >
        <p>{text('agentChat.contextPreview')}</p>
        {contextManifest.currentDocumentPath ? (
          <strong>{contextManifest.currentDocumentPath}</strong>
        ) : null}
        <span>{text('agentChat.maxPermission')}</span>
        {contextManifest.selectedText ? (
          <blockquote>{contextManifest.selectedText}</blockquote>
        ) : null}
      </section>

      <section
        aria-live="polite"
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
              <p>{message.content}</p>
            </article>
          ))
        ) : (
          <p className="agent-chat-empty">{text('agentChat.noMessages')}</p>
        )}
      </section>

      {changedFilesSummary?.available && changedFilesSummary.files.length > 0 ? (
        <section
          className="agent-chat-changed-files"
          data-component-id={COMPONENT_IDS.agentChat.changedFiles}
        >
          <h3>{text('agentChat.changedFiles')}</h3>
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
      ) : null}

      {isActiveSessionSending ? (
        <p
          className="agent-chat-thinking"
          data-component-id={COMPONENT_IDS.agentChat.thinkingStatus}
          role="status"
        >
          <LoaderCircle aria-hidden="true" size={14} />
          <span>{text('agentChat.thinking')}</span>
        </p>
      ) : null}

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
        {attachments.length > 0 ? (
          <div className="agent-chat-attachments">
            {attachments.map((attachment) => (
              <span
                className="agent-chat-attachment-chip"
                data-component-id={COMPONENT_IDS.agentChat.attachmentChip}
                key={attachment.attachmentId}
              >
                {attachment.fileName}
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
              </span>
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
        <div className="agent-chat-composer-actions">
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
            <span>{text('agentChat.attachImage')}</span>
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
            className="agent-chat-icon-button"
            data-component-id={COMPONENT_IDS.agentChat.stopButton}
            disabled={!activeSession || !isActiveSessionSending}
            onClick={() => {
              void stopSession();
            }}
            title={text('agentChat.stop')}
            type="button"
          >
            <Square aria-hidden="true" size={14} />
            <span>{text('agentChat.stop')}</span>
          </button>
          <button
            className="agent-chat-send-button"
            data-component-id={COMPONENT_IDS.agentChat.sendButton}
            disabled={isActiveSessionSending}
            type="submit"
          >
            <Send aria-hidden="true" size={15} />
            <span>{text('agentChat.send')}</span>
          </button>
        </div>
      </form>
    </aside>
  );
}
