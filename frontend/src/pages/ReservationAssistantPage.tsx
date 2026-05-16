import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Bot, Clock3, RefreshCw, SendHorizonal, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { assistantApi } from "../api/services";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { Textarea } from "../components/ui/Textarea";
import { useAuth } from "../store/AuthContext";
import type { ReservationAssistantCategory, ReservationAssistantPresentation } from "../types/api";
import { formatDate, formatTimeRange } from "../utils/format";

type ConversationMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  category?: ReservationAssistantCategory;
  suggestions?: string[];
  presentation?: ReservationAssistantPresentation;
};

type ApiErrorBody = {
  message?: string;
  errors?: Record<string, string[]>;
};

const promptSuggestions = [
  "May schedule ba next month?",
  "available ba ang CL-302 bukas?",
  "What schedules are available this week?",
  "Ano reservation ko ngayon?",
  "What are the reservation rules?"
];
const ASSISTANT_SESSION_STORAGE_KEY = "comportAssistantConversation";

export const ReservationAssistantPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [lastSubmittedMessage, setLastSubmittedMessage] = useState<string | null>(null);
  const [hasRestoredConversation, setHasRestoredConversation] = useState(false);
  const messageFeedEndRef = useRef<HTMLDivElement | null>(null);
  const storageKey = user ? `${ASSISTANT_SESSION_STORAGE_KEY}:${user.id}` : null;

  const assistantMutation = useMutation({
    mutationFn: assistantApi.askReservationAssistant,
    onSuccess: (response) => {
      setAssistantError(null);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.reply,
          category: response.category,
          suggestions: response.suggestions,
          presentation: response.presentation
        }
      ]);
    },
    onError: (error) => {
      const axiosError = error as AxiosError<ApiErrorBody>;
      const statusCode = axiosError.response?.status;

      if (statusCode === 401) {
        const message = "Please log in to use the ComPort Assistant.";
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
          "Please adjust your question and try again.";
        setAssistantError(validationMessage);
        toast.error(validationMessage);
        return;
      }

      const fallbackMessage = "Sorry, I couldn't reach the assistant right now. Please try again.";
      setAssistantError(fallbackMessage);
      toast.error(fallbackMessage);
    }
  });

  useEffect(() => {
    const previousTitle = document.title;
    const descriptionTag = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionTag?.getAttribute("content") ?? "";

    document.title = "ComPort Assistant | ComPort";
    descriptionTag?.setAttribute(
      "content",
      "ComPort Assistant provides grounded help for laboratory schedules, reservation status, room availability, and reservation rules."
    );

    return () => {
      document.title = previousTitle;
      descriptionTag?.setAttribute("content", previousDescription);
    };
  }, []);

  useEffect(() => {
    messageFeedEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, assistantMutation.isPending, assistantError]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    try {
      const rawConversation = sessionStorage.getItem(storageKey);

      if (!rawConversation) {
        setMessages([]);
        setLastSubmittedMessage(null);
        return;
      }

      const parsedConversation = JSON.parse(rawConversation) as {
        messages?: ConversationMessage[];
        lastSubmittedMessage?: string | null;
      };

      setMessages(parsedConversation.messages ?? []);
      setLastSubmittedMessage(parsedConversation.lastSubmittedMessage ?? null);
    } catch (error) {
      console.error("[assistant] Failed to restore session conversation.", error);
      setMessages([]);
      setLastSubmittedMessage(null);
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
        lastSubmittedMessage
      })
    );
  }, [hasRestoredConversation, lastSubmittedMessage, messages, storageKey]);

  const sendMessage = (message: string) => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || assistantMutation.isPending) {
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
    if (!lastSubmittedMessage || assistantMutation.isPending) {
      return;
    }

    setAssistantError(null);
    assistantMutation.mutate(lastSubmittedMessage);
  };

  const canSend = Boolean(draft.trim()) && !assistantMutation.isPending;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <PageHeader
        title="ComPort Assistant"
        description="Ask for reservation help in plain language. Answers stay grounded in live schedules, room availability, your reservations, and the rules already enforced by the system."
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
                    AI Reservation Assistant
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">ComPort Assistant</p>
                  <p className="text-xs text-slate-500">
                    Answers stay grounded in current reservation system data.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-white px-3 py-1.5 text-slate-600 shadow-soft">
                  Live schedule context
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 text-slate-600 shadow-soft">
                  Reservation-aware replies
                </span>
              </div>
            </div>
          </div>

          <div
            className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6"
            role="log"
            aria-live="polite"
            aria-busy={assistantMutation.isPending}
          >
            {!messages.length && !assistantMutation.isPending ? (
              <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
                <img
                  src="/comport-logo.png"
                  alt="ComPort logo"
                  className="h-20 w-20 rounded-3xl border border-slate-200 bg-white object-cover p-1 shadow-soft"
                />
                <h2 className="mt-5 text-2xl font-semibold text-slate-900">
                  Start with a reservation question
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                  Ask about schedules, available laboratories, your upcoming reservations, or the
                  rules already enforced by the system. If data is missing, the assistant will say
                  so instead of guessing.
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
                    {message.role === "user" ? "You" : "ComPort Assistant"}
                  </p>
                  <p className="whitespace-pre-line break-words">{message.content}</p>
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
                          disabled={assistantMutation.isPending}
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
                    ComPort Assistant
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-brand-300 [animation-delay:-0.2s]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-brand-400 [animation-delay:-0.1s]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                    </span>
                    <span>Thinking through your reservation question...</span>
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
                  disabled={assistantMutation.isPending}
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
                placeholder="Ask about schedules, laboratories, reservation rules, or your upcoming reservations."
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
                  Press Enter to send. Use Shift+Enter for a new line. The assistant uses current
                  reservation system records and asks follow-up questions when details are missing.
                </p>
                <Button
                  type="button"
                  className="w-full justify-center sm:w-auto"
                  disabled={!canSend}
                  onClick={() => sendMessage(draft)}
                >
                  <SendHorizonal className="mr-2 h-4 w-4" />
                  Send to ComPort Assistant
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
                <h2 className="text-lg font-semibold text-slate-900">Best Questions</h2>
                <p className="text-sm text-slate-500">
                  The assistant is strongest when you ask about current system records.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <p>Published schedule windows by day or week</p>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <p>Laboratory availability for a date or room code</p>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <p>Your own upcoming reservations and recent request outcomes</p>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <p>Open time slots by day, week, and specific laboratory</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Scope Guardrails</h2>
                <p className="text-sm text-slate-500">Reliable answers start with matchable data.</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              ComPort Assistant does not guess missing data and it does not answer unrelated
              questions. If a laboratory name cannot be matched, try the exact room code such as
              <span className="font-semibold text-slate-900"> CL-301</span>.
            </p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
              Fallback replies are labeled <span className="font-semibold text-slate-700">Using system data</span>. That means the answer came directly from current records without an external AI provider.
            </div>
          </Card>
        </div>
      </div>
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
            {reservation.pcNumber ? (
              <p className="mt-2 text-xs font-semibold text-slate-600">
                PC assignment: {reservation.pcNumber}
              </p>
            ) : null}
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
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {presentation.laboratory.description}
        </p>
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
