import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  Bot,
  CheckCircle2,
  Ellipsis,
  MessageSquareText,
  RefreshCw,
  SendHorizonal,
  ShieldCheck,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { assistantApi } from "../api/services";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { useAuth } from "../store/AuthContext";
import type {
  AssistantPendingAction,
  ReservationAssistantCategory,
  ReservationAssistantPresentation,
  ReservationAssistantResponse,
  UserRole
} from "../types/api";
import { roleLabels } from "../utils/constants";
import { formatDate, formatDateTime, formatTimeRange } from "../utils/format";

type ConversationMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  category?: ReservationAssistantCategory;
  suggestions?: string[];
  presentation?: ReservationAssistantPresentation;
  pendingAction?: AssistantPendingAction;
};

type ApiErrorBody = {
  message?: string;
  errors?: Record<string, string[]>;
};

type ResolvedActionStatus = "confirmed" | "cancelled";

const ASSISTANT_SESSION_STORAGE_KEY = "comportAssistantConversation";

const promptSuggestionsByRole: Record<UserRole, string[]> = {
  ADMIN: [
    "Show system summary.",
    "Pending reservations today.",
    "Create bulk schedule next week 8-5.",
    "Add laboratory CL-305.",
    "Manage schedules.",
    "Show active labs."
  ],
  LABORATORY_STAFF: [
    "Pending reservations today.",
    "Show approved reservations.",
    "Check lab schedules.",
    "Create schedule draft.",
    "Reservation rules.",
    "Notifications."
  ],
  STUDENT: [
    "Who am I?",
    "My reservations today.",
    "Available schedules tomorrow.",
    "Step-by-step reservation.",
    "Reservation rules.",
    "My notifications."
  ]
};

const roleWorkspaceCopy: Record<
  UserRole,
  {
    capabilities: string[];
  }
> = {
  ADMIN: {
    capabilities: [
      "View system-wide summaries, activity, laboratories, and reservations.",
      "Draft bulk approvals, rejections, and schedule creation with strong confirmation.",
      "Create, update, deactivate, or safely delete laboratories when policy allows."
    ]
  },
  LABORATORY_STAFF: {
    capabilities: [
      "Review pending reservations and lab activity in your assigned scope.",
      "Create schedule drafts for your laboratory with conflict-aware previews.",
      "Approve or reject reservations only when your staff assignment allows it."
    ]
  },
  STUDENT: {
    capabilities: [
      "Check your reservation status, upcoming bookings, and notifications.",
      "Ask whether a lab is available on a date or time range.",
      "Prepare reservation or cancellation drafts that still require your confirmation."
    ]
  }
};

const safetyFlowItems = [
  "Every sensitive request checks your authenticated role on the backend.",
  "Write actions stay in preview mode until you explicitly confirm them.",
  "High-risk actions require the exact typed phrase before execution."
];

export const ReservationAssistantPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [lastSubmittedMessage, setLastSubmittedMessage] = useState<string | null>(null);
  const [hasRestoredConversation, setHasRestoredConversation] = useState(false);
  const [resolvedActionIds, setResolvedActionIds] = useState<Record<string, ResolvedActionStatus>>(
    {}
  );
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const toolsButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousMessageCountRef = useRef(0);
  const shouldForceScrollRef = useRef(false);
  const storageKey = user ? `${ASSISTANT_SESSION_STORAGE_KEY}:${user.id}` : null;
  const promptSuggestions = user
    ? promptSuggestionsByRole[user.role]
    : promptSuggestionsByRole.STUDENT;
  const composerPromptSuggestions = promptSuggestions.slice(0, 3);
  const roleCopy = user ? roleWorkspaceCopy[user.role] : roleWorkspaceCopy.STUDENT;

  const appendAssistantResponse = (response: ReservationAssistantResponse) => {
    setAssistantError(null);
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.reply,
        category: response.category,
        suggestions: response.suggestions,
        presentation: response.presentation,
        pendingAction: response.pendingAction
      }
    ]);
  };

  const handleAssistantError = (error: unknown, fallbackMessage: string) => {
    const axiosError = error as AxiosError<ApiErrorBody>;
    const statusCode = axiosError.response?.status;

    if (statusCode === 401) {
      const message = "Please log in to use ComPort GPT.";
      setAssistantError(message);
      toast.error(message);
      navigate("/login", {
        state: {
          authMessage: message,
          from: { pathname: "/assistant" }
        }
      });
      return;
    }

    if (statusCode === 400) {
      const rawValidationMessage =
        axiosError.response?.data?.errors?.message?.[0] ??
        axiosError.response?.data?.message ??
        fallbackMessage;
      const validationMessage =
        rawValidationMessage === "Invalid request data."
          ? "I couldn't process that assistant request. Please try a shorter question or choose one of the examples."
          : rawValidationMessage;
      setAssistantError(validationMessage);
      toast.error(validationMessage);
      return;
    }

    setAssistantError(fallbackMessage);
    toast.error(fallbackMessage);
  };

  const assistantMutation = useMutation({
    mutationFn: assistantApi.askReservationAssistant,
    onSuccess: appendAssistantResponse,
    onError: (error) => {
      handleAssistantError(
        error,
        "Sorry, I couldn't complete that request. Please try again."
      );
    }
  });

  const confirmActionMutation = useMutation({
    mutationFn: ({
      actionId,
      confirmation
    }: {
      actionId: string;
      confirmation?: string;
    }) => assistantApi.confirmPendingAction(actionId, confirmation),
    onSuccess: (response, variables) => {
      appendAssistantResponse(response);
      setResolvedActionIds((current) => ({
        ...current,
        [variables.actionId]: "confirmed"
      }));
    },
    onError: (error) => {
      handleAssistantError(
        error,
        "Sorry, I couldn't complete that request. Please try again."
      );
    }
  });

  const cancelActionMutation = useMutation({
    mutationFn: ({ actionId }: { actionId: string }) => assistantApi.cancelPendingAction(actionId),
    onSuccess: (response, variables) => {
      appendAssistantResponse(response);
      setResolvedActionIds((current) => ({
        ...current,
        [variables.actionId]: "cancelled"
      }));
    },
    onError: (error) => {
      handleAssistantError(
        error,
        "Sorry, I couldn't complete that request. Please try again."
      );
    }
  });

  const isBusy =
    assistantMutation.isPending ||
    confirmActionMutation.isPending ||
    cancelActionMutation.isPending;
  const activePendingAction = useMemo(() => {
    for (const message of [...messages].reverse()) {
      if (
        message.pendingAction &&
        !resolvedActionIds[message.pendingAction.actionId]
      ) {
        return message.pendingAction;
      }
    }

    return null;
  }, [messages, resolvedActionIds]);

  const isNearBottom = () => {
    const viewport = messageViewportRef.current;

    if (!viewport) {
      return true;
    }

    return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 112;
  };

  const scrollToLatest = (behavior: ScrollBehavior = "smooth") => {
    const viewport = messageViewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior
    });
    setShowJumpToLatest(false);
  };

  useEffect(() => {
    const previousTitle = document.title;
    const descriptionTag = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionTag?.getAttribute("content") ?? "";

    document.title = "ComPort GPT | ComPort";
    descriptionTag?.setAttribute(
      "content",
      "ComPort GPT is the role-aware system assistant for grounded reservation, schedule, and laboratory workflows."
    );

    return () => {
      document.title = previousTitle;
      descriptionTag?.setAttribute("content", previousDescription);
    };
  }, []);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    try {
      const rawConversation = sessionStorage.getItem(storageKey);

      if (!rawConversation) {
        setMessages([]);
        setLastSubmittedMessage(null);
        setResolvedActionIds({});
        return;
      }

      const parsedConversation = JSON.parse(rawConversation) as {
        messages?: ConversationMessage[];
        lastSubmittedMessage?: string | null;
        resolvedActionIds?: Record<string, ResolvedActionStatus>;
      };

      setMessages(parsedConversation.messages ?? []);
      setLastSubmittedMessage(parsedConversation.lastSubmittedMessage ?? null);
      setResolvedActionIds(parsedConversation.resolvedActionIds ?? {});
    } catch {
      setMessages([]);
      setLastSubmittedMessage(null);
      setResolvedActionIds({});
    } finally {
      setHasRestoredConversation(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !hasRestoredConversation) {
      return;
    }

    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        messages: messages.slice(-20),
        lastSubmittedMessage,
        resolvedActionIds
      })
    );
  }, [hasRestoredConversation, lastSubmittedMessage, messages, resolvedActionIds, storageKey]);

  useEffect(() => {
    if (!hasRestoredConversation) {
      return;
    }

    previousMessageCountRef.current = messages.length;

    if (messages.length) {
      requestAnimationFrame(() => {
        scrollToLatest("auto");
      });
    }
  }, [hasRestoredConversation, messages.length]);

  useEffect(() => {
    if (!showTools) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowTools(false);
        toolsButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showTools]);

  useEffect(() => {
    if (!hasRestoredConversation) {
      return;
    }

    if (messages.length === previousMessageCountRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      if (shouldForceScrollRef.current || isNearBottom()) {
        scrollToLatest("smooth");
      } else {
        setShowJumpToLatest(true);
      }

      shouldForceScrollRef.current = false;
      previousMessageCountRef.current = messages.length;
    });
  }, [hasRestoredConversation, messages.length]);

  const sendMessage = (message: string) => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || isBusy) {
      return;
    }

    shouldForceScrollRef.current = true;
    setAssistantError(null);
    setLastSubmittedMessage(trimmedMessage);
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmedMessage
      }
    ]);
    setDraft("");
    assistantMutation.mutate(trimmedMessage);

    requestAnimationFrame(() => {
      const composer = document.getElementById("assistant-composer");
      if (composer instanceof HTMLTextAreaElement) {
        composer.focus();
      }
    });
  };

  const retryLastQuestion = () => {
    if (!lastSubmittedMessage || isBusy) {
      return;
    }

    shouldForceScrollRef.current = true;
    setAssistantError(null);
    assistantMutation.mutate(lastSubmittedMessage);
  };

  const canSend = Boolean(draft.trim()) && !isBusy;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section
        aria-label="ComPort GPT assistant"
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft"
      >
        <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/comport-logo.png"
              alt=""
              className="h-9 w-9 shrink-0 rounded-xl border border-slate-200 bg-white object-cover p-1"
            />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">ComPort GPT</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Ready <span className="text-slate-300" aria-hidden="true">·</span>
                {user ? roleLabels[user.role] : "Role-aware"}
              </p>
            </div>
          </div>

          <div className="relative shrink-0">
            <button
              ref={toolsButtonRef}
              type="button"
              aria-label="Open assistant tools"
              aria-expanded={showTools}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
              onClick={() => setShowTools((open) => !open)}
            >
              {showTools ? <X className="h-5 w-5" /> : <Ellipsis className="h-5 w-5" />}
            </button>

            {showTools ? (
              <AssistantToolsPopover
                capabilities={roleCopy.capabilities}
                onClose={() => setShowTools(false)}
              />
            ) : null}
          </div>
        </header>

        <div className="relative min-h-0 flex-1 bg-slate-50/70">
            <div
              ref={messageViewportRef}
              className="comport-assistant-scroll h-full min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
              role="log"
              aria-live="polite"
              aria-busy={isBusy}
              onScroll={() => {
                setShowJumpToLatest(!isNearBottom());
              }}
            >
              {!messages.length && !assistantMutation.isPending ? (
                <EmptyState
                  prompts={composerPromptSuggestions}
                  onPrompt={sendMessage}
                />
              ) : null}

              <div className="space-y-3">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    resolvedActionStatus={message.pendingAction ? resolvedActionIds[message.pendingAction.actionId] : undefined}
                    isConfirming={
                      confirmActionMutation.isPending &&
                      confirmActionMutation.variables?.actionId === message.pendingAction?.actionId
                    }
                    isCancelling={
                      cancelActionMutation.isPending &&
                      cancelActionMutation.variables?.actionId === message.pendingAction?.actionId
                    }
                    onConfirm={(confirmation) => {
                      if (!message.pendingAction) {
                        return;
                      }

                      shouldForceScrollRef.current = true;
                      confirmActionMutation.mutate({
                        actionId: message.pendingAction.actionId,
                        confirmation
                      });
                    }}
                    onCancel={() => {
                      if (!message.pendingAction) {
                        return;
                      }

                      shouldForceScrollRef.current = true;
                      cancelActionMutation.mutate({
                        actionId: message.pendingAction.actionId
                      });
                    }}
                    onPrompt={sendMessage}
                  />
                ))}

                {isBusy ? <LoadingBubble /> : null}
              </div>
            </div>

            {showJumpToLatest ? (
              <button
                type="button"
                className="absolute bottom-4 right-4 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-soft transition hover:border-brand-200 hover:text-brand-700"
                onClick={() => scrollToLatest("smooth")}
              >
                Jump to latest
              </button>
            ) : null}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-5 sm:py-4">
            {assistantError ? (
              <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{assistantError}</span>
                  {lastSubmittedMessage ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 transition hover:text-amber-700"
                      onClick={retryLastQuestion}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="comport-assistant-prompt-scroll mb-2 flex gap-2 overflow-x-auto pb-1">
              {activePendingAction ? (
                <PromptChip
                  label="Cancel current action"
                  onClick={() => {
                    shouldForceScrollRef.current = true;
                    cancelActionMutation.mutate({
                      actionId: activePendingAction.actionId
                    });
                  }}
                  disabled={isBusy}
                />
              ) : null}
              {composerPromptSuggestions.map((prompt) => (
                <PromptChip
                  key={prompt}
                  label={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={isBusy}
                />
              ))}
            </div>

            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 transition focus-within:border-brand-300 focus-within:bg-white focus-within:shadow-soft sm:p-2">
              <Textarea
                id="assistant-composer"
                value={draft}
                aria-label="Message ComPort GPT"
                placeholder="Ask ComPort GPT..."
                className="min-h-[2.75rem] max-h-32 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 shadow-none focus:border-0 focus:shadow-none"
                rows={2}
                disabled={isBusy}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (canSend) {
                      sendMessage(draft);
                    }
                  }
                }}
              />

              <Button
                type="button"
                aria-label={isBusy ? "ComPort GPT is working" : "Send message"}
                className="h-10 min-h-10 w-10 shrink-0 rounded-xl p-0"
                disabled={!canSend}
                onClick={() => sendMessage(draft)}
              >
                <SendHorizonal className="h-4 w-4" />
              </Button>
            </div>
        </footer>
      </section>
    </div>
  );
};

const EmptyState = ({
  prompts,
  onPrompt
}: {
  prompts: string[];
  onPrompt: (prompt: string) => void;
}) => (
  <div className="flex min-h-full items-center justify-center py-8">
    <div className="flex max-w-md flex-col items-center text-center">
      <div className="mb-4 rounded-2xl border border-brand-100 bg-brand-50 p-3 text-brand-700">
        <MessageSquareText className="h-5 w-5" />
      </div>
      <p className="font-display text-xl font-bold text-slate-900">ComPort GPT</p>
      <p className="mt-1 text-sm text-slate-500">How can I help you?</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
          onClick={() => onPrompt(prompt)}
        >
          {prompt}
        </button>
      ))}
      </div>
    </div>
  </div>
);

const ChatMessage = ({
  message,
  resolvedActionStatus,
  isConfirming,
  isCancelling,
  onConfirm,
  onCancel,
  onPrompt
}: {
  message: ConversationMessage;
  resolvedActionStatus?: ResolvedActionStatus;
  isConfirming: boolean;
  isCancelling: boolean;
  onConfirm: (confirmation?: string) => void;
  onCancel: () => void;
  onPrompt: (prompt: string) => void;
}) => (
  <div className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
    <div
      className={
        message.role === "user"
          ? "max-w-[88%] rounded-[1.35rem] rounded-br-md bg-brand-700 px-4 py-3 text-sm leading-6 text-white shadow-soft lg:max-w-[60%]"
          : "max-w-3xl px-1 py-1 text-sm leading-6 text-slate-700"
      }
    >
      <p
        className={
          message.role === "user"
            ? "mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-100"
            : "mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"
        }
      >
        {message.role === "user" ? "You" : "ComPort GPT"}
      </p>
      <p className="whitespace-pre-line break-words">{message.content}</p>

      {message.role === "assistant" && message.pendingAction ? (
        <div className="mt-3">
          <PendingActionCard
            action={message.pendingAction}
            resolvedStatus={resolvedActionStatus}
            isConfirming={isConfirming}
            isCancelling={isCancelling}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </div>
      ) : null}

      {message.role === "assistant" && message.presentation ? (
        <div className="mt-3">
          <AssistantPresentationCard presentation={message.presentation} />
        </div>
      ) : null}

      {message.role === "assistant" && message.suggestions?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.suggestions.slice(0, 4).map((suggestion) => (
            <PromptChip
              key={suggestion}
              label={suggestion}
              onClick={() => onPrompt(suggestion)}
              compact
            />
          ))}
        </div>
      ) : null}
    </div>
  </div>
);

const LoadingBubble = () => (
  <div className="flex justify-start">
    <div className="max-w-3xl px-1 py-1 text-sm text-slate-700">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        ComPort GPT
      </p>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700">ComPort GPT is checking system records...</span>
        <span className="comport-assistant-typing" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  </div>
);

const AssistantToolsPopover = ({
  capabilities,
  onClose
}: {
  capabilities: string[];
  onClose: () => void;
}) => (
  <div
    className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_50px_-20px_rgba(27,52,86,0.42)]"
    role="dialog"
    aria-label="Assistant information"
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">Assistant information</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Actions remain protected until confirmed.</p>
      </div>
      <button
        type="button"
        aria-label="Close assistant information"
        className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-300"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
    <div className="mt-4 space-y-4">
      <section aria-labelledby="assistant-safety-title">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <ShieldCheck className="h-4 w-4 text-brand-600" />
          <h2 id="assistant-safety-title">Safety flow</h2>
        </div>
        <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">
          {safetyFlowItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="assistant-capabilities-title">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Bot className="h-4 w-4 text-brand-600" />
          <h2 id="assistant-capabilities-title">Your scope</h2>
        </div>
        <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">
          {capabilities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  </div>
);

const PromptChip = ({
  label,
  onClick,
  disabled,
  compact = false
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}) => (
  <button
    type="button"
    className={
      compact
        ? "rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        : "rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
    }
    disabled={disabled}
    onClick={onClick}
  >
    {label}
  </button>
);

const PendingActionCard = ({
  action,
  resolvedStatus,
  isConfirming,
  isCancelling,
  onConfirm,
  onCancel
}: {
  action: AssistantPendingAction;
  resolvedStatus?: ResolvedActionStatus;
  isConfirming: boolean;
  isCancelling: boolean;
  onConfirm: (confirmation?: string) => void;
  onCancel: () => void;
}) => {
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const requiresTypedConfirmation =
    action.requiredConfirmationLevel === "HIGH" && Boolean(action.confirmationPhrase);
  const isResolved = Boolean(resolvedStatus);
  const confirmationStatusLabel =
    action.requiredConfirmationLevel === "HIGH"
      ? "Strong confirmation required"
      : action.requiredConfirmationLevel === "MEDIUM"
        ? "Explicit confirmation required"
        : "Quick confirmation required";

  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{action.title}</p>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-700">
              {action.requiredConfirmationLevel}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{action.summary}</p>
        </div>
        <div className="rounded-xl border border-brand-100 bg-white px-3 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Affected</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{action.affectedCount}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <MetaTile label="Confirmation" value={confirmationStatusLabel} />
        <MetaTile label="Expires" value={formatDateTime(action.expiresAt)} />
      </div>

      {action.warnings.length ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900">Warnings</p>
          <div className="mt-2 space-y-2">
            {action.warnings.map((warning) => (
              <div
                key={warning}
                className="rounded-xl border border-amber-200/80 bg-white/70 px-3 py-2 text-sm text-amber-900"
              >
                {warning}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {requiresTypedConfirmation && action.confirmationPhrase ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Type this phrase
          </p>
          <div className="rounded-2xl bg-slate-900 px-3 py-3 text-xs font-semibold tracking-[0.12em] text-white">
            {action.confirmationPhrase}
          </div>
          {!isResolved ? (
            <Input
              value={typedConfirmation}
              placeholder="Type the exact confirmation phrase"
              onChange={(event) => setTypedConfirmation(event.target.value)}
            />
          ) : null}
        </div>
      ) : null}

      {isResolved ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700">
          {resolvedStatus === "confirmed" ? "Action sent for execution" : "Action cancelled"}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="w-full justify-center sm:w-auto"
            disabled={
              isConfirming ||
              isCancelling ||
              (requiresTypedConfirmation &&
                typedConfirmation.trim() !== action.confirmationPhrase)
            }
            onClick={() =>
              onConfirm(requiresTypedConfirmation ? typedConfirmation.trim() : undefined)
            }
          >
            {isConfirming ? "Confirming..." : "Confirm"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center sm:w-auto"
            disabled={isConfirming || isCancelling}
            onClick={onCancel}
          >
            {isCancelling ? "Cancelling..." : "Cancel"}
          </Button>
        </div>
      )}
    </div>
  );
};

const MetaTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
  </div>
);

const AssistantPresentationCard = ({
  presentation
}: {
  presentation: ReservationAssistantPresentation;
}) => {
  if (presentation.type === "schedule-results") {
    return (
      <div className="space-y-2">
        <PresentationHeader
          title={presentation.title}
          subtitle={`Showing ${presentation.showingCount} of ${presentation.totalCount} schedule entries`}
          badge={presentation.hasMore ? "More available" : undefined}
        />
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {presentation.groups.map((group) => (
            <div key={group.date} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">{formatDate(group.date)}</p>
              <div className="mt-2 space-y-2">
                {group.laboratories.map((laboratory) => (
                  <div
                    key={`${group.date}-${laboratory.roomCode}`}
                    className="rounded-2xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {laboratory.roomCode} - {laboratory.laboratoryName}
                        </p>
                        <p className="text-xs text-slate-500">{laboratory.building}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                        {formatTimeRange(
                          ...(laboratory.scheduleWindow.split("-") as [string, string])
                        )}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {laboratory.availableSlots.map((slot) => (
                        <span
                          key={`${group.date}-${laboratory.roomCode}-${slot.startTime}`}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
                        >
                          {formatTimeRange(slot.startTime, slot.endTime)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (presentation.type === "laboratory-results") {
    return (
      <div className="space-y-2">
        <PresentationHeader
          title={presentation.title}
          subtitle={`Showing ${presentation.showingCount} of ${presentation.totalCount} laboratories`}
        />
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {presentation.laboratories.map((laboratory) => (
            <div key={laboratory.roomCode} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {laboratory.roomCode} - {laboratory.laboratoryName}
                  </p>
                  <p className="text-xs text-slate-500">{laboratory.building}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {laboratory.nextOpenWindows.map((slot) => (
                  <span
                    key={`${laboratory.roomCode}-${slot.date}-${slot.startTime}`}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
                  >
                    {formatDate(slot.date)} - {formatTimeRange(slot.startTime, slot.endTime)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (presentation.type === "reservation-results") {
    return (
      <div className="space-y-2">
        <PresentationHeader
          title={presentation.title}
          subtitle={`${presentation.reservations.length} reservation${presentation.reservations.length === 1 ? "" : "s"} shown`}
        />
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {presentation.reservations.map((reservation) => (
            <div
              key={reservation.reservationCode}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {reservation.roomCode} - {reservation.laboratoryName}
                </p>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  {reservation.status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <span>{formatDate(reservation.date)}</span>
                <span>{formatTimeRange(reservation.startTime, reservation.endTime)}</span>
                <span>{reservation.reservationType}</span>
                {reservation.pcNumber ? <span>PC: {reservation.pcNumber}</span> : null}
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{reservation.purpose}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                {reservation.studentName ? (
                  <span>
                    {reservation.studentName}
                    {reservation.studentNumber ? ` (${reservation.studentNumber})` : ""}
                  </span>
                ) : null}
                {reservation.reviewedByName ? <span>Reviewed by: {reservation.reviewedByName}</span> : null}
                {reservation.remarks ? <span>Remarks: {reservation.remarks}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (presentation.type === "user-profile") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">{presentation.user.name}</p>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
            {roleLabels[presentation.user.role]}
          </span>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          <p>Email: {presentation.user.email}</p>
          {presentation.user.studentNumber ? (
            <p>Student number: {presentation.user.studentNumber}</p>
          ) : null}
          {presentation.user.yearLevel ? <p>Year level: {presentation.user.yearLevel}</p> : null}
          {presentation.user.department ? <p>Department: {presentation.user.department}</p> : null}
          <p>
            Verification:{" "}
            {presentation.user.verificationStatus === "verified" ? "Verified" : "Unverified"}
          </p>
          <p>Joined: {formatDate(presentation.user.createdAt)}</p>
        </div>
      </div>
    );
  }

  if (presentation.type === "notification-results") {
    return (
      <div className="space-y-2">
        <PresentationHeader
          title={presentation.title}
          subtitle={`${presentation.unreadCount} unread notification${presentation.unreadCount === 1 ? "" : "s"}`}
        />
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {presentation.notifications.map((notification) => (
            <div key={notification.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{notification.subject}</p>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  {notification.readAt ? "Read" : "Unread"}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">{notification.message}</p>
              <p className="mt-2 text-[11px] text-slate-500">{formatDateTime(notification.createdAt)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (presentation.type === "stats") {
    return (
      <div className="space-y-2">
        <PresentationHeader
          title={presentation.title}
          badge={presentation.scope === "admin" ? "Admin" : "Staff"}
        />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {presentation.items.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {item.label}
              </p>
              <p className="mt-1.5 text-lg font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (presentation.type === "activity-results") {
    return (
      <div className="space-y-2">
        <PresentationHeader title={presentation.title} />
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {presentation.activities.map((activity) => (
            <div key={activity.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{activity.description}</p>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  {activity.action}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                {activity.actorName ? (
                  <span>
                    {activity.actorName}
                    {activity.actorRole ? ` (${roleLabels[activity.actorRole]})` : ""}
                  </span>
                ) : null}
                {activity.laboratoryRoomCode ? <span>Lab: {activity.laboratoryRoomCode}</span> : null}
                <span>{formatDateTime(activity.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (presentation.type === "user-list") {
    return (
      <div className="space-y-2">
        <PresentationHeader
          title={presentation.title}
          subtitle={`${presentation.users.length} user${presentation.users.length === 1 ? "" : "s"} shown`}
        />
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {presentation.users.map((user) => (
            <div key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  {roleLabels[user.role]}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {user.assignedLaboratories.length
                  ? `Assigned labs: ${user.assignedLaboratories.join(", ")}`
                  : "No assigned laboratory listed"}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (presentation.type === "laboratory-details") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">
            {presentation.laboratory.roomCode} - {presentation.laboratory.name}
          </p>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
            {presentation.laboratory.status}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span>{presentation.laboratory.building}</span>
          {presentation.laboratory.location ? <span>{presentation.laboratory.location}</span> : null}
          <span>Capacity: {presentation.laboratory.capacity}</span>
          <span>Computers: {presentation.laboratory.computerCount}</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600">{presentation.laboratory.description}</p>
      </div>
    );
  }

  if (presentation.type === "laboratory-catalog") {
    return (
      <div className="space-y-2">
        <PresentationHeader
          title={presentation.title}
          subtitle={`${presentation.laboratories.length} laborator${presentation.laboratories.length === 1 ? "y" : "ies"} shown`}
        />
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {presentation.laboratories.map((laboratory) => (
            <div key={laboratory.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {laboratory.roomCode} - {laboratory.name}
                </p>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                  {laboratory.status}
                </span>
              </div>
              <div className="mt-2 grid gap-2 text-[11px] text-slate-500 sm:grid-cols-2">
                <span>{laboratory.building}</span>
                <span>Capacity: {laboratory.capacity}</span>
                <span>Computers: {laboratory.computerCount}</span>
                <span>Staff: {laboratory.assignedStaffName ?? "None"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (presentation.type === "assigned-laboratory") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        {presentation.laboratory ? (
          <>
            <p className="text-sm font-semibold text-slate-900">
              {presentation.laboratory.roomCode} - {presentation.laboratory.name}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span>{presentation.laboratory.building}</span>
              <span>Status: {presentation.laboratory.status}</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-600">No assigned laboratory found.</p>
        )}
      </div>
    );
  }

  if (presentation.type === "summary") {
    return (
      <div className="space-y-2">
        <PresentationHeader title={presentation.title} />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {presentation.items.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {item.label}
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
        {presentation.notes?.length ? (
          <div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
            {presentation.notes.map((note, index) => (
              <p key={`${note}-${index}`}>{note}</p>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (presentation.type === "capabilities") {
    return (
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <PresentationHeader title={presentation.title} badge={roleLabels[presentation.role]} compact />
        <CapabilityBlock title="Read access" items={presentation.read} />
        <CapabilityBlock title="Write access" items={presentation.write} />
        <CapabilityBlock title="Blocked access" items={presentation.denied} />
        {presentation.notes.length ? (
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
            {presentation.notes.map((note, index) => (
              <p key={`${note}-${index}`}>{note}</p>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <PresentationHeader title={presentation.title} compact />
      <div className="mt-3 space-y-2">
        {presentation.items.map((item) => (
          <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const PresentationHeader = ({
  title,
  subtitle,
  badge,
  compact = false
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  compact?: boolean;
}) => (
  <div className={compact ? "rounded-2xl border border-slate-200 bg-white px-3 py-2.5" : "rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {badge ? (
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
          {badge}
        </span>
      ) : null}
    </div>
  </div>
);

const CapabilityBlock = ({ title, items }: { title: string; items: string[] }) => (
  <div className="space-y-2">
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
    <div className="space-y-2 text-sm text-slate-600">
      {items.map((item) => (
        <div key={item} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 leading-5">
          {item}
        </div>
      ))}
    </div>
  </div>
);
