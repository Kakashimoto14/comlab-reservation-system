import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  Bot,
  CheckCircle2,
  Clock3,
  RefreshCw,
  SendHorizonal,
  ShieldCheck,
  Sparkles,
  XCircle
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { assistantApi } from "../api/services";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
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
  STUDENT: [
    "Who am I?",
    "Ano reservation ko ngayon?",
    "Available ba CL-302 bukas?",
    "Reserve CL-302 tomorrow 9-10 for programming.",
    "What are the reservation rules?"
  ],
  LABORATORY_STAFF: [
    "Who am I?",
    "Show reservations needing approval.",
    "Show my lab schedule this week.",
    "Create schedule for my lab this week 8-5.",
    "Summarize today's reservations."
  ],
  ADMIN: [
    "Who am I?",
    "Show system summary.",
    "How many pending reservations?",
    "Create schedules for all active labs next week 8-5.",
    "Add laboratory CL-304."
  ]
};

export const ReservationAssistantPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [lastSubmittedMessage, setLastSubmittedMessage] = useState<string | null>(null);
  const [hasRestoredConversation, setHasRestoredConversation] = useState(false);
  const [resolvedActionIds, setResolvedActionIds] = useState<Record<string, ResolvedActionStatus>>({});
  const messageFeedEndRef = useRef<HTMLDivElement | null>(null);
  const storageKey = user ? `${ASSISTANT_SESSION_STORAGE_KEY}:${user.id}` : null;
  const promptSuggestions = user ? promptSuggestionsByRole[user.role] : promptSuggestionsByRole.STUDENT;

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
      const validationMessage =
        axiosError.response?.data?.errors?.message?.[0] ??
        axiosError.response?.data?.message ??
        fallbackMessage;
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

  useEffect(() => {
    const previousTitle = document.title;
    const descriptionTag = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionTag?.getAttribute("content") ?? "";

    document.title = "ComPort GPT | ComPort";
    descriptionTag?.setAttribute(
      "content",
      "ComPort GPT is the role-aware assistant for grounded reservation answers, schedule checks, previews, and safe confirmed actions."
    );

    return () => {
      document.title = previousTitle;
      descriptionTag?.setAttribute("content", previousDescription);
    };
  }, []);

  useEffect(() => {
    messageFeedEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [
    messages,
    assistantMutation.isPending,
    confirmActionMutation.isPending,
    cancelActionMutation.isPending,
    assistantError
  ]);

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
    } catch (error) {
      console.error("[assistant] Failed to restore session conversation.", error);
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

  const sendMessage = (message: string) => {
    const trimmedMessage = message.trim();

    if (
      !trimmedMessage ||
      assistantMutation.isPending ||
      confirmActionMutation.isPending ||
      cancelActionMutation.isPending
    ) {
      return;
    }

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
    if (
      !lastSubmittedMessage ||
      assistantMutation.isPending ||
      confirmActionMutation.isPending ||
      cancelActionMutation.isPending
    ) {
      return;
    }

    setAssistantError(null);
    assistantMutation.mutate(lastSubmittedMessage);
  };

  const canSend = Boolean(draft.trim()) && !assistantMutation.isPending;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <PageHeader
        title="ComPort GPT"
        description="Ask in English, Tagalog, or Taglish. ComPort GPT stays grounded in your authenticated role, system records, and safe confirmed workflows."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.9fr)]">
        <Card className="flex min-h-[34rem] flex-col overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(73,111,182,0.12),_transparent_30%),linear-gradient(180deg,_#ffffff,_#f8fafc)] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/comport-logo.png"
                  alt="ComPort logo"
                  className="h-12 w-12 rounded-2xl border border-slate-200 bg-white object-cover p-1 shadow-soft"
                />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
                    Role-Aware AI Assistant
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">ComPort GPT</p>
                  <p className="text-xs text-slate-500">
                    Answers and actions stay grounded in ComPort system records.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-white px-3 py-1.5 text-slate-600 shadow-soft">
                  {user ? roleLabels[user.role] : "Role-aware"}
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 text-slate-600 shadow-soft">
                  Draft + confirm actions
                </span>
              </div>
            </div>
          </div>

          <div
            className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6"
            role="log"
            aria-live="polite"
            aria-busy={
              assistantMutation.isPending ||
              confirmActionMutation.isPending ||
              cancelActionMutation.isPending
            }
          >
            {!messages.length && !assistantMutation.isPending ? (
              <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
                <img
                  src="/comport-logo.png"
                  alt="ComPort logo"
                  className="h-20 w-20 rounded-3xl border border-slate-200 bg-white object-cover p-1 shadow-soft"
                />
                <h2 className="mt-5 text-2xl font-semibold text-slate-900">
                  Start with a ComPort question
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                  Ask about identity, reservations, laboratory availability, schedules, approval
                  queues, summaries, or safe admin and staff actions. If the records do not confirm
                  something, ComPort GPT will say so instead of guessing.
                </p>
                <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
                  {promptSuggestions.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-700"
                      onClick={() => sendMessage(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[90%] rounded-3xl rounded-br-lg bg-brand-700 px-4 py-3 text-sm leading-6 text-white shadow-soft sm:max-w-[85%]"
                      : "max-w-[90%] rounded-3xl rounded-bl-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 shadow-soft sm:max-w-[85%]"
                  }
                >
                  <p
                    className={
                      message.role === "user"
                        ? "mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-100"
                        : "mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                    }
                  >
                    {message.role === "user" ? "You" : "ComPort GPT"}
                  </p>
                  <p className="whitespace-pre-line break-words">{message.content}</p>
                  {message.role === "assistant" && message.pendingAction ? (
                    <div className="mt-4">
                      <PendingActionCard
                        action={message.pendingAction}
                        resolvedStatus={resolvedActionIds[message.pendingAction.actionId]}
                        isConfirming={
                          confirmActionMutation.isPending &&
                          confirmActionMutation.variables?.actionId === message.pendingAction.actionId
                        }
                        isCancelling={
                          cancelActionMutation.isPending &&
                          cancelActionMutation.variables?.actionId === message.pendingAction.actionId
                        }
                        onConfirm={(confirmation) =>
                          confirmActionMutation.mutate({
                            actionId: message.pendingAction!.actionId,
                            confirmation
                          })
                        }
                        onCancel={() =>
                          cancelActionMutation.mutate({
                            actionId: message.pendingAction!.actionId
                          })
                        }
                      />
                    </div>
                  ) : null}
                  {message.role === "assistant" && message.presentation ? (
                    <div className="mt-4">
                      <AssistantPresentationCard presentation={message.presentation} />
                    </div>
                  ) : null}
                  {message.role === "assistant" && message.suggestions?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {message.suggestions.map((suggestion) => (
                        <button
                          key={`${message.id}-${suggestion}`}
                          type="button"
                          disabled={
                            assistantMutation.isPending ||
                            confirmActionMutation.isPending ||
                            cancelActionMutation.isPending
                          }
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => sendMessage(suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {assistantMutation.isPending ? (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-3xl rounded-bl-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 shadow-soft sm:max-w-[85%]">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    ComPort GPT
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-brand-300 [animation-delay:-0.2s]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-brand-400 [animation-delay:-0.1s]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                    </span>
                    <span>ComPort GPT is checking system records...</span>
                  </div>
                </div>
              </div>
            ) : null}

            {assistantError ? (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-3xl rounded-bl-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-soft sm:max-w-[85%]">
                  <p>{assistantError}</p>
                  {lastSubmittedMessage ? (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-2 font-semibold text-amber-900 underline"
                      onClick={retryLastQuestion}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Retry last question
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div ref={messageFeedEndRef} />
          </div>

          <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
            <div className="mb-3 flex flex-wrap gap-2">
              {promptSuggestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={
                    assistantMutation.isPending ||
                    confirmActionMutation.isPending ||
                    cancelActionMutation.isPending
                  }
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <Textarea
                id="assistant-composer"
                value={draft}
                className="min-h-[7.5rem] resize-y"
                placeholder="Ask in English, Tagalog, or Taglish. Example: approve all pending today, available ba CL-302 bukas, or reserve CL-302 tomorrow 9-10."
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage(draft);
                  }
                }}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Press Enter to send. Shift+Enter adds a new line. Risky actions stay in draft
                  mode until you explicitly confirm them.
                </p>
                <Button
                  type="button"
                  className="w-full justify-center sm:w-auto"
                  disabled={!canSend}
                  onClick={() => sendMessage(draft)}
                >
                  <SendHorizonal className="mr-2 h-4 w-4" />
                  Send to ComPort GPT
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Suggested Prompts</h2>
                <p className="text-sm text-slate-500">
                  Suggestions adapt to your current authenticated role.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-600">
              {promptSuggestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
                  onClick={() => sendMessage(prompt)}
                >
                  <Bot className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Safety Flow</h2>
                <p className="text-sm text-slate-500">
                  Draft first, confirm second, then execute.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <p>ComPort GPT prepares a preview before it changes reservations, schedules, or laboratories.</p>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p>Low and medium risk actions need explicit confirmation. High risk actions require an exact typed phrase.</p>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <p>No database change happens before confirmation, and unsafe or unauthorized actions are blocked.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

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
  const requiresTypedConfirmation = action.requiredConfirmationLevel === "HIGH";
  const isResolved = Boolean(resolvedStatus);
  const isBusy = isConfirming || isCancelling;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{action.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            Expires {formatDateTime(action.expiresAt)}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
          {action.requiredConfirmationLevel}
        </span>
      </div>

      <div className="mt-4 space-y-3 text-sm text-slate-600">
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <p>{action.summary}</p>
        </div>
        <p>
          Affected records: <span className="font-semibold text-slate-900">{action.affectedCount}</span>
        </p>
        {action.warnings.length ? (
          <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
            {action.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
        {requiresTypedConfirmation && action.confirmationPhrase ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Required confirmation phrase
            </p>
            <div className="rounded-2xl bg-slate-900 px-4 py-3 text-xs font-semibold tracking-[0.16em] text-white">
              {action.confirmationPhrase}
            </div>
            {!isResolved ? (
              <Input
                value={typedConfirmation}
                placeholder="Type the exact phrase"
                onChange={(event) => setTypedConfirmation(event.target.value)}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {isResolved ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          {resolvedStatus === "confirmed" ? "Action sent for execution" : "Action cancelled"}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="w-full justify-center sm:w-auto"
            disabled={
              isBusy ||
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
            disabled={isBusy}
            onClick={onCancel}
          >
            {isCancelling ? "Cancelling..." : "Cancel"}
          </Button>
        </div>
      )}
    </div>
  );
};

const AssistantPresentationCard = ({
  presentation
}: {
  presentation: ReservationAssistantPresentation;
}) => {
  if (presentation.type === "schedule-results") {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{presentation.title}</p>
              <p className="text-xs text-slate-500">
                Showing {presentation.showingCount} of {presentation.totalCount} available
                schedule entries
              </p>
            </div>
            {presentation.hasMore ? (
              <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                More available
              </span>
            ) : null}
          </div>
        </div>

        {presentation.groups.map((group) => (
          <div key={group.date} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">{formatDate(group.date)}</p>
            <div className="mt-3 space-y-3">
              {group.laboratories.map((laboratory) => (
                <div key={`${group.date}-${laboratory.roomCode}`} className="rounded-2xl bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {laboratory.roomCode} - {laboratory.laboratoryName}
                      </p>
                      <p className="text-xs text-slate-500">{laboratory.building}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                      Published {formatTimeRange(...laboratory.scheduleWindow.split("-") as [string, string])}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {laboratory.availableSlots.map((slot) => (
                      <span
                        key={`${group.date}-${laboratory.roomCode}-${slot.startTime}`}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
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
    );
  }

  if (presentation.type === "laboratory-results") {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{presentation.title}</p>
          <p className="text-xs text-slate-500">
            Showing {presentation.showingCount} of {presentation.totalCount} laboratories
          </p>
        </div>

        {presentation.laboratories.map((laboratory) => (
          <div key={laboratory.roomCode} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">
              {laboratory.roomCode} - {laboratory.laboratoryName}
            </p>
            <p className="text-xs text-slate-500">{laboratory.building}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {laboratory.nextOpenWindows.map((slot) => (
                <span
                  key={`${laboratory.roomCode}-${slot.date}-${slot.startTime}`}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                >
                  {formatDate(slot.date)} - {formatTimeRange(slot.startTime, slot.endTime)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (presentation.type === "reservation-results") {
    return (
      <div className="space-y-3">
        {presentation.reservations.map((reservation) => (
          <div
            key={reservation.reservationCode}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {reservation.roomCode} - {reservation.laboratoryName}
              </p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                {reservation.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {formatDate(reservation.date)} - {formatTimeRange(reservation.startTime, reservation.endTime)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{reservation.purpose}</p>
            {reservation.studentName ? (
              <p className="mt-2 text-xs text-slate-500">
                Submitted by: {reservation.studentName}
                {reservation.studentNumber ? ` (${reservation.studentNumber})` : ""}
              </p>
            ) : null}
            {reservation.pcNumber ? (
              <p className="mt-2 text-xs font-semibold text-slate-600">
                PC assignment: {reservation.pcNumber}
              </p>
            ) : null}
            {reservation.reviewedByName ? (
              <p className="mt-2 text-xs text-slate-500">
                Reviewed by: {reservation.reviewedByName}
              </p>
            ) : null}
            {reservation.remarks ? (
              <p className="mt-2 text-xs text-slate-500">Remarks: {reservation.remarks}</p>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (presentation.type === "user-profile") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">{presentation.user.name}</p>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
            {roleLabels[presentation.user.role]}
          </span>
        </div>
        <div className="mt-3 space-y-2 text-sm text-slate-600">
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
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{presentation.title}</p>
          <p className="text-xs text-slate-500">
            {presentation.unreadCount} unread notification
            {presentation.unreadCount === 1 ? "" : "s"}
          </p>
        </div>

        {presentation.notifications.map((notification) => (
          <div key={notification.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{notification.subject}</p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                {notification.readAt ? "Read" : "Unread"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{notification.message}</p>
            <p className="mt-2 text-xs text-slate-500">{formatDateTime(notification.createdAt)}</p>
          </div>
        ))}
      </div>
    );
  }

  if (presentation.type === "stats") {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{presentation.title}</p>
          <p className="text-xs text-slate-500">
            Scope: {presentation.scope === "admin" ? "Admin" : "Staff"}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {presentation.items.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (presentation.type === "activity-results") {
    return (
      <div className="space-y-3">
        {presentation.activities.map((activity) => (
          <div key={activity.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{activity.description}</p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                {activity.action}
              </span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-slate-500">
              {activity.actorName ? (
                <p>
                  Actor: {activity.actorName}
                  {activity.actorRole ? ` (${roleLabels[activity.actorRole]})` : ""}
                </p>
              ) : null}
              {activity.laboratoryRoomCode ? <p>Laboratory: {activity.laboratoryRoomCode}</p> : null}
              <p>{formatDateTime(activity.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (presentation.type === "user-list") {
    return (
      <div className="space-y-3">
        {presentation.users.map((user) => (
          <div key={user.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                {roleLabels[user.role]}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {user.assignedLaboratories.length
                ? `Assigned labs: ${user.assignedLaboratories.join(", ")}`
                : "No assigned laboratory listed"}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (presentation.type === "laboratory-details") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">
            {presentation.laboratory.roomCode} - {presentation.laboratory.name}
          </p>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
            {presentation.laboratory.status}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600">{presentation.laboratory.building}</p>
        {presentation.laboratory.location ? (
          <p className="mt-1 text-xs text-slate-500">{presentation.laboratory.location}</p>
        ) : null}
        <p className="mt-2 text-xs text-slate-500">
          Capacity: {presentation.laboratory.capacity} | Computers: {presentation.laboratory.computerCount}
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {presentation.laboratory.description}
        </p>
      </div>
    );
  }

  if (presentation.type === "laboratory-catalog") {
    return (
      <div className="space-y-3">
        {presentation.laboratories.map((laboratory) => (
          <div key={laboratory.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {laboratory.roomCode} - {laboratory.name}
              </p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                {laboratory.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{laboratory.building}</p>
            <p className="mt-2 text-xs text-slate-500">
              Capacity: {laboratory.capacity} | Computers: {laboratory.computerCount}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Assigned staff: {laboratory.assignedStaffName ?? "None"}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (presentation.type === "assigned-laboratory") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {presentation.laboratory ? (
          <>
            <p className="text-sm font-semibold text-slate-900">
              {presentation.laboratory.roomCode} - {presentation.laboratory.name}
            </p>
            <p className="mt-2 text-xs text-slate-500">{presentation.laboratory.building}</p>
            <p className="mt-2 text-xs text-slate-500">
              Status: {presentation.laboratory.status}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-600">No assigned laboratory found.</p>
        )}
      </div>
    );
  }

  if (presentation.type === "summary") {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{presentation.title}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {presentation.items.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                {item.label}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
        {presentation.notes?.length ? (
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            {presentation.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (presentation.type === "capabilities") {
    return (
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">{presentation.title}</p>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
            {roleLabels[presentation.role]}
          </span>
        </div>
        <div className="space-y-2 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Read access</p>
          {presentation.read.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
        <div className="space-y-2 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Write access</p>
          {presentation.write.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
        <div className="space-y-2 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Blocked access</p>
          {presentation.denied.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{presentation.title}</p>
      <div className="mt-3 space-y-3">
        {presentation.items.map((item) => (
          <div key={item.title} className="rounded-2xl bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
