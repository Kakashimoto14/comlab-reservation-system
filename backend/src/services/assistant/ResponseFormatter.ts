import type {
  ActivitySummary,
  AssistantLanguage,
  AssistantPresentation,
  CalendarSyncContextResult,
  CurrentUserContextResult,
  DateRange,
  GeneralHelpContext,
  LaboratoryAvailabilityResult,
  LaboratoryLookupResult,
  LaboratorySummary,
  NotificationsContextResult,
  RecentActivityContextResult,
  ReservationAssistantResponse,
  ReservationResultsContext,
  ReservationRule,
  ScheduleAvailability,
  ScheduleAvailabilityResult,
  StaffDirectoryContextResult,
  SystemInfoContextResult,
  SystemStatsContextResult
} from "./types.js";

type BaseResponse = Omit<ReservationAssistantResponse, "mode">;

export class ResponseFormatter {
  formatOutOfScope(language: AssistantLanguage): BaseResponse {
    return {
      category: "out_of_scope",
      reply: this.pick(language, {
        english:
          "I'm focused on ComPort reservations, labs, schedules, notifications, and system records. If you want, I can check your account details or reservation data.",
        tagalog:
          "Naka-focus ako sa ComPort reservations, laboratoryo, schedules, notifications, at system records. Kung gusto mo, pwede kong tingnan ang account details o reservation data mo.",
        taglish:
          "Focused ako sa ComPort reservations, labs, schedules, notifications, at system records. Kung gusto mo, pwede kong i-check ang account details or reservation data mo."
      }),
      suggestions: this.pick(language, {
        english: [
          "Who am I?",
          "What are my reservations today?",
          "Is CL-302 available tomorrow?"
        ],
        tagalog: [
          "Sino ako?",
          "Ano ang reservations ko ngayong araw?",
          "Available ba ang CL-302 bukas?"
        ],
        taglish: [
          "Who am I?",
          "Ano reservation ko ngayon?",
          "Available ba ang CL-302 bukas?"
        ]
      })
    };
  }

  formatGeneralHelp(language: AssistantLanguage, context: GeneralHelpContext): BaseResponse {
    return {
      category: "general_reservation_help",
      reply: this.pick(language, {
        english: `I can help with your account details, reservations, notifications, available schedules, laboratory availability, and reservation rules. In ${context.rangeLabel}, the system currently shows ${context.availableLaboratories} available laboratories and ${context.scheduleCount} published schedule blocks.`,
        tagalog: `Matutulungan kita sa account details mo, reservations, notifications, available schedules, laboratory availability, at reservation rules. Para sa ${context.rangeLabel}, may ${context.availableLaboratories} available na laboratoryo at ${context.scheduleCount} published schedule blocks sa system.`,
        taglish: `Pwede kitang tulungan sa account details mo, reservations, notifications, available schedules, laboratory availability, at reservation rules. Sa ${context.rangeLabel}, may ${context.availableLaboratories} available laboratories at ${context.scheduleCount} published schedule blocks sa system.`
      }),
      suggestions: this.pick(language, {
        english: [
          "Who am I?",
          "What schedules are available this week?",
          "What notifications do I have?"
        ],
        tagalog: [
          "Sino ako?",
          "Anong schedules ang available ngayong linggo?",
          "Ano ang notifications ko?"
        ],
        taglish: [
          "Who am I?",
          "What schedules are available this week?",
          "Ano notifications ko?"
        ]
      })
    };
  }

  formatCurrentUser(
    language: AssistantLanguage,
    context: CurrentUserContextResult
  ): BaseResponse {
    const roleLabel = this.roleLabel(context.role);
    const emailLine = this.pick(language, {
      english: `Your registered email is ${context.email}.`,
      tagalog: `Ang registered email mo ay ${context.email}.`,
      taglish: `Ang registered email mo is ${context.email}.`
    });
    const studentNumberLine = context.studentNumber
      ? this.pick(language, {
          english: `Your student number is ${context.studentNumber}.`,
          tagalog: `Ang student number mo ay ${context.studentNumber}.`,
          taglish: `Ang student number mo is ${context.studentNumber}.`
        })
      : null;

    return {
      category: "current_user",
      reply: [
        this.pick(language, {
          english: `You are ${context.name}, a ${roleLabel} in ComPort.`,
          tagalog: `Ikaw si ${context.name}, isang ${roleLabel} sa ComPort.`,
          taglish: `Ikaw si ${context.name}, a ${roleLabel} in ComPort.`
        }),
        emailLine,
        studentNumberLine
      ]
        .filter(Boolean)
        .join(" "),
      suggestions: this.pick(language, {
        english: [
          "What are my upcoming reservations?",
          "What notifications do I have?",
          "What is my latest reservation status?"
        ],
        tagalog: [
          "Ano ang mga susunod kong reservations?",
          "Ano ang notifications ko?",
          "Ano ang latest reservation status ko?"
        ],
        taglish: [
          "What are my upcoming reservations?",
          "Ano notifications ko?",
          "Ano latest reservation status ko?"
        ]
      }),
      presentation: {
        type: "user-profile",
        title: this.pick(language, {
          english: "Your ComPort account",
          tagalog: "Iyong ComPort account",
          taglish: "Your ComPort account"
        }),
        user: {
          name: context.name,
          role: context.role,
          email: context.email,
          studentNumber: context.studentNumber,
          yearLevel: context.yearLevel,
          department: context.department,
          verificationStatus: context.verificationStatus,
          createdAt: context.createdAt
        }
      }
    };
  }

  formatRules(language: AssistantLanguage, rules: ReservationRule[]): BaseResponse {
    return {
      category: "reservation_rules",
      reply: this.pick(language, {
        english: "These are the reservation rules I can verify from the current system behavior and records.",
        tagalog: "Ito ang reservation rules na na-verify ko mula sa kasalukuyang system behavior at records.",
        taglish: "Ito ang reservation rules na verified ko from the current system behavior and records."
      }),
      suggestions: this.pick(language, {
        english: ["What schedules are available tomorrow?", "Show my reservations."],
        tagalog: ["Anong schedules ang available bukas?", "Ipakita ang reservations ko."],
        taglish: ["May available schedule ba bukas?", "Ano reservation ko?"]
      }),
      presentation: {
        type: "rules",
        title: this.pick(language, {
          english: "Verified reservation rules",
          tagalog: "Na-verify na reservation rules",
          taglish: "Verified reservation rules"
        }),
        items: rules
      }
    };
  }

  formatReservations(
    language: AssistantLanguage,
    context: ReservationResultsContext,
    range: DateRange,
    question: string
  ): BaseResponse {
    const wantsLatest = /latest|pinakabago|huli/.test(question);
    const wantsToday = /\btoday\b|ngayon/.test(question) || range.label === "today";
    const wantsUpcoming = /upcoming|susunod/.test(question);

    if (!context.reservations.length) {
      return {
        category: "my_reservations",
        reply: this.pick(language, {
          english: wantsToday
            ? "You do not have a reservation today based on the current system records."
            : wantsLatest
              ? "I could not find a latest reservation record for your account yet."
              : wantsUpcoming
                ? "I could not find any upcoming reservations for your account in the current records."
                : `I couldn't find any of your reservations for ${context.rangeLabel} in the current records.`,
          tagalog: wantsToday
            ? "Wala kang reservation ngayong araw base sa current system records."
            : wantsLatest
              ? "Wala pa akong makitang latest reservation record para sa account mo."
              : wantsUpcoming
                ? "Wala akong makitang upcoming reservations para sa account mo sa current records."
                : `Wala akong nakitang reservations mo para sa ${context.rangeLabel} sa kasalukuyang records.`,
          taglish: wantsToday
            ? "Wala kang reservation ngayong araw based sa current system records."
            : wantsLatest
              ? "Wala pa akong makitang latest reservation record for your account."
              : wantsUpcoming
                ? "Wala akong makitang upcoming reservations for your account sa current records."
                : `Wala akong nakita na reservations mo for ${context.rangeLabel} sa current records.`
        }),
        suggestions: this.pick(language, {
          english: [
            "Show my reservations this week.",
            "Is CL-302 available tomorrow?",
            "What notifications do I have?"
          ],
          tagalog: [
            "Ipakita ang reservations ko ngayong linggo.",
            "Available ba ang CL-302 bukas?",
            "Ano ang notifications ko?"
          ],
          taglish: [
            "Ano reservation ko this week?",
            "Available ba ang CL-302 bukas?",
            "Ano notifications ko?"
          ]
        })
      };
    }

    const latestReservation = context.reservations[0];
    const reply = wantsLatest
      ? this.pick(language, {
          english: `Your latest reservation status is ${latestReservation.status.toLowerCase()} for ${latestReservation.roomCode} on ${latestReservation.date}.`,
          tagalog: `Ang latest reservation status mo ay ${latestReservation.status.toLowerCase()} para sa ${latestReservation.roomCode} noong ${latestReservation.date}.`,
          taglish: `Ang latest reservation status mo is ${latestReservation.status.toLowerCase()} for ${latestReservation.roomCode} on ${latestReservation.date}.`
        })
      : wantsToday
        ? this.pick(language, {
            english: "Here is your reservation record for today based on the current system records.",
            tagalog: "Narito ang reservation record mo ngayong araw base sa current system records.",
            taglish: "Ito ang reservation record mo for today based sa current system records."
          })
        : wantsUpcoming
          ? this.pick(language, {
              english: "Here are your upcoming reservations from the current system records.",
              tagalog: "Narito ang mga upcoming reservations mo mula sa current system records.",
              taglish: "Ito ang upcoming reservations mo from the current system records."
            })
          : this.pick(language, {
              english: `Here are your reservations for ${context.rangeLabel}.`,
              tagalog: `Narito ang mga reservations mo para sa ${context.rangeLabel}.`,
              taglish: `Ito ang reservations mo for ${context.rangeLabel}.`
            });

    return {
      category: "my_reservations",
      reply,
      suggestions:
        range.granularity === "day"
          ? this.pick(language, {
              english: [
                "What about next week?",
                "What is my latest reservation status?",
                "What notifications do I have?"
              ],
              tagalog: [
                "Paano naman sa susunod na linggo?",
                "Ano ang latest reservation status ko?",
                "Ano ang notifications ko?"
              ],
              taglish: [
                "Paano naman next week?",
                "Ano latest reservation status ko?",
                "Ano notifications ko?"
              ]
            })
          : this.pick(language, {
              english: [
                "Show my reservations tomorrow.",
                "Is CL-302 available?",
                "What is my role?"
              ],
              tagalog: [
                "Ipakita ang reservations ko bukas.",
                "Available ba ang CL-302?",
                "Ano ang role ko?"
              ],
              taglish: ["Ano reservation ko bukas?", "May available ba sa CL-302?", "Ano role ko?"]
            }),
      presentation: {
        type: "reservation-results",
        title: this.pick(language, {
          english: "Your reservations",
          tagalog: "Iyong reservations",
          taglish: "Your reservations"
        }),
        reservations: context.reservations
      }
    };
  }

  formatNotifications(
    language: AssistantLanguage,
    context: NotificationsContextResult
  ): BaseResponse {
    if (!context.notifications.length) {
      return {
        category: "notifications",
        reply: this.pick(language, {
          english: "You do not have any notification records yet.",
          tagalog: "Wala ka pang notification records sa ngayon.",
          taglish: "Wala ka pang notification records right now."
        }),
        suggestions: this.pick(language, {
          english: [
            "What are my reservations today?",
            "What is my latest reservation status?",
            "What are the reservation rules?"
          ],
          tagalog: [
            "Ano ang reservations ko ngayong araw?",
            "Ano ang latest reservation status ko?",
            "Ano ang reservation rules?"
          ],
          taglish: [
            "Ano reservation ko ngayon?",
            "Ano latest reservation status ko?",
            "Ano reservation rules?"
          ]
        })
      };
    }

    return {
      category: "notifications",
      reply: this.pick(language, {
        english: `You have ${context.unreadCount} unread notification${context.unreadCount === 1 ? "" : "s"} in ComPort.`,
        tagalog: `May ${context.unreadCount} unread notification${context.unreadCount === 1 ? "" : "s"} ka sa ComPort.`,
        taglish: `May ${context.unreadCount} unread notification${context.unreadCount === 1 ? "" : "s"} ka sa ComPort.`
      }),
      suggestions: this.pick(language, {
        english: [
          "What are my reservations today?",
          "What is my latest reservation status?",
          "Who am I?"
        ],
        tagalog: [
          "Ano ang reservations ko ngayong araw?",
          "Ano ang latest reservation status ko?",
          "Sino ako?"
        ],
        taglish: ["Ano reservation ko ngayon?", "Ano latest reservation status ko?", "Who am I?"]
      }),
      presentation: {
        type: "notification-results",
        title: this.pick(language, {
          english: "Your notifications",
          tagalog: "Iyong notifications",
          taglish: "Your notifications"
        }),
        unreadCount: context.unreadCount,
        notifications: context.notifications
      }
    };
  }

  formatAdminStats(language: AssistantLanguage, context: SystemStatsContextResult): BaseResponse {
    const pending = context.stats.find((item) => item.label === "Pending reservations")?.value ?? 0;

    return {
      category: "admin_stats",
      reply: this.pick(language, {
        english: `There are ${pending} pending reservations in your ${context.scope === "admin" ? "admin" : "staff"} scope right now.`,
        tagalog: `May ${pending} pending reservations sa ${context.scope === "admin" ? "admin" : "staff"} scope mo ngayon.`,
        taglish: `May ${pending} pending reservations sa ${context.scope === "admin" ? "admin" : "staff"} scope mo right now.`
      }),
      suggestions: this.pick(language, {
        english: [
          "Which reservations need approval?",
          "What recent actions happened?",
          "Who submitted the latest reservation?"
        ],
        tagalog: [
          "Aling reservations ang kailangang i-approve?",
          "Anong recent actions ang nangyari?",
          "Sino ang nagsumite ng latest reservation?"
        ],
        taglish: [
          "Show reservations needing approval.",
          "What recent actions happened?",
          "Who submitted the latest reservation?"
        ]
      }),
      presentation: {
        type: "stats",
        title: this.pick(language, {
          english: "Reservation stats",
          tagalog: "Reservation stats",
          taglish: "Reservation stats"
        }),
        scope: context.scope,
        items: context.stats
      }
    };
  }

  formatApprovalQueue(
    language: AssistantLanguage,
    context: ReservationResultsContext
  ): BaseResponse {
    if (!context.reservations.length) {
      return {
        category: "approval_queue",
        reply: this.pick(language, {
          english: "I could not find any reservations waiting for approval in your current scope.",
          tagalog: "Wala akong makitang reservations na naghihintay ng approval sa current scope mo.",
          taglish: "Wala akong makitang reservations waiting for approval sa current scope mo."
        }),
        suggestions: this.pick(language, {
          english: ["How many pending reservations?", "What recent actions happened?"],
          tagalog: ["Ilan ang pending reservations?", "Anong recent actions ang nangyari?"],
          taglish: ["How many pending reservations?", "What recent actions happened?"]
        })
      };
    }

    return {
      category: "approval_queue",
      reply: this.pick(language, {
        english: "These reservations currently need approval in your visible management scope.",
        tagalog: "Ito ang mga reservations na kasalukuyang kailangan ng approval sa visible management scope mo.",
        taglish: "Ito ang mga reservations na currently need approval sa visible management scope mo."
      }),
      suggestions: this.pick(language, {
        english: ["How many pending reservations?", "Who submitted the latest reservation?"],
        tagalog: ["Ilan ang pending reservations?", "Sino ang nagsumite ng latest reservation?"],
        taglish: ["How many pending reservations?", "Who submitted the latest reservation?"]
      }),
      presentation: {
        type: "reservation-results",
        title: this.pick(language, {
          english: "Reservations needing approval",
          tagalog: "Reservations na kailangang i-approve",
          taglish: "Reservations needing approval"
        }),
        reservations: context.reservations
      }
    };
  }

  formatReservationSubmitter(
    language: AssistantLanguage,
    reservation: ReservationResultsContext["reservations"][number]
  ): BaseResponse {
    return {
      category: "reservation_submitter",
      reply: this.pick(language, {
        english: `${reservation.studentName ?? "The student"} submitted reservation ${reservation.reservationCode} for ${reservation.roomCode} on ${reservation.date}.`,
        tagalog: `${reservation.studentName ?? "Ang estudyante"} ang nagsumite ng reservation ${reservation.reservationCode} para sa ${reservation.roomCode} noong ${reservation.date}.`,
        taglish: `${reservation.studentName ?? "The student"} submitted reservation ${reservation.reservationCode} for ${reservation.roomCode} on ${reservation.date}.`
      }),
      suggestions: this.pick(language, {
        english: ["Which reservations need approval?", "What recent actions happened?"],
        tagalog: ["Aling reservations ang kailangang i-approve?", "Anong recent actions ang nangyari?"],
        taglish: ["Show reservations needing approval.", "What recent actions happened?"]
      }),
      presentation: {
        type: "reservation-results",
        title: this.pick(language, {
          english: "Referenced reservation",
          tagalog: "Referenced reservation",
          taglish: "Referenced reservation"
        }),
        reservations: [reservation]
      }
    };
  }

  formatRecentActivity(
    language: AssistantLanguage,
    context: RecentActivityContextResult
  ): BaseResponse {
    if (!context.activities.length) {
      return {
        category: "recent_activity",
        reply: this.pick(language, {
          english: "I could not find recent activity records in your current scope.",
          tagalog: "Wala akong makitang recent activity records sa current scope mo.",
          taglish: "Wala akong makitang recent activity records sa current scope mo."
        }),
        suggestions: this.pick(language, {
          english: ["How many pending reservations?", "Which reservations need approval?"],
          tagalog: ["Ilan ang pending reservations?", "Aling reservations ang kailangang i-approve?"],
          taglish: ["How many pending reservations?", "Show reservations needing approval."]
        })
      };
    }

    return {
      category: "recent_activity",
      reply: this.pick(language, {
        english: "These are the most recent activity records I can confirm from your current management scope.",
        tagalog: "Ito ang mga recent activity records na mako-confirm ko mula sa current management scope mo.",
        taglish: "Ito ang most recent activity records na ma-confirm ko from your current management scope."
      }),
      suggestions: this.pick(language, {
        english: ["How many pending reservations?", "Who submitted the latest reservation?"],
        tagalog: ["Ilan ang pending reservations?", "Sino ang nagsumite ng latest reservation?"],
        taglish: ["How many pending reservations?", "Who submitted the latest reservation?"]
      }),
      presentation: {
        type: "activity-results",
        title: this.pick(language, {
          english: "Recent activity",
          tagalog: "Recent activity",
          taglish: "Recent activity"
        }),
        scope: context.scope,
        activities: context.activities
      }
    };
  }

  formatSystemInfo(language: AssistantLanguage, context: SystemInfoContextResult): BaseResponse {
    return {
      category: "system_info",
      reply: this.pick(language, {
        english: context.summary,
        tagalog:
          "Ang ComPort ay ang ComLab reservation system para sa laboratory schedules, reservation requests, approvals, notifications, at role-based laboratory management.",
        taglish:
          "Ang ComPort ay ang ComLab reservation system for laboratory schedules, reservation requests, approvals, notifications, at role-based laboratory management."
      }),
      suggestions: this.pick(language, {
        english: [
          "What are the reservation rules?",
          "What schedules are available this week?",
          "Who am I?"
        ],
        tagalog: [
          "Ano ang reservation rules?",
          "Anong schedules ang available ngayong linggo?",
          "Sino ako?"
        ],
        taglish: ["Ano reservation rules?", "What schedules are available this week?", "Who am I?"]
      })
    };
  }

  formatCalendarSync(
    language: AssistantLanguage,
    context: CalendarSyncContextResult
  ): BaseResponse {
    if (!context.enabled) {
      return {
        category: "calendar_sync",
        reply: this.pick(language, {
          english:
            "Google Calendar sync is currently disabled in ComPort. Approved reservations stay valid in ComPort, but they will not be created in Google Calendar until an admin enables the backend integration.",
          tagalog:
            "Naka-disable ngayon ang Google Calendar sync sa ComPort. Valid pa rin ang approved reservations sa ComPort, pero hindi sila gagawin sa Google Calendar hangga't hindi ito ini-enable ng admin sa backend.",
          taglish:
            "Disabled ngayon ang Google Calendar sync sa ComPort. Valid pa rin ang approved reservations sa ComPort, pero hindi sila mace-create sa Google Calendar until i-enable ito ng admin sa backend."
        }),
        suggestions: this.pick(language, {
          english: ["Show my reservations.", "What is my latest reservation status?"],
          tagalog: ["Ipakita ang reservations ko.", "Ano ang latest reservation status ko?"],
          taglish: ["Show my reservations.", "Ano latest reservation status ko?"]
        })
      };
    }

    if (!context.reservation) {
      return {
        category: "calendar_sync",
        reply: this.pick(language, {
          english:
            context.scope === "own"
              ? "I cannot find an approved reservation for your account to check against Google Calendar sync yet."
              : "I cannot find an approved reservation in your visible management scope to check against Google Calendar sync yet.",
          tagalog:
            context.scope === "own"
              ? "Wala pa akong makitang approved reservation sa account mo para i-check sa Google Calendar sync."
              : "Wala pa akong makitang approved reservation sa visible management scope mo para i-check sa Google Calendar sync.",
          taglish:
            context.scope === "own"
              ? "Wala pa akong makitang approved reservation sa account mo to check against Google Calendar sync."
              : "Wala pa akong makitang approved reservation sa visible management scope mo to check against Google Calendar sync."
        }),
        suggestions: this.pick(language, {
          english: ["Show my reservations.", "What schedules are available this week?"],
          tagalog: ["Ipakita ang reservations ko.", "Anong schedules ang available ngayong linggo?"],
          taglish: ["Show my reservations.", "What schedules are available this week?"]
        })
      };
    }

    const reservation = context.reservation;

    if (reservation.calendarSyncStatus === "SYNCED") {
      return {
        category: "calendar_sync",
        reply: this.pick(language, {
          english: `Reservation ${reservation.reservationCode} for ${reservation.roomCode} is marked as synced to Google Calendar in the ComPort records.`,
          tagalog: `Ang reservation ${reservation.reservationCode} para sa ${reservation.roomCode} ay naka-mark na synced sa Google Calendar sa ComPort records.`,
          taglish: `Reservation ${reservation.reservationCode} for ${reservation.roomCode} is marked as synced sa Google Calendar sa ComPort records.`
        }),
        suggestions: this.pick(language, {
          english: ["Show my reservations.", "What notifications do I have?"],
          tagalog: ["Ipakita ang reservations ko.", "Ano ang notifications ko?"],
          taglish: ["Show my reservations.", "Ano notifications ko?"]
        })
      };
    }

    if (reservation.calendarSyncStatus === "FAILED") {
      return {
        category: "calendar_sync",
        reply: this.pick(language, {
          english: `Reservation ${reservation.reservationCode} is approved, but ComPort records show Google Calendar sync failed. The reservation is still approved in ComPort; an admin or lab staff member should check the calendar configuration.`,
          tagalog: `Approved ang reservation ${reservation.reservationCode}, pero ayon sa ComPort records ay failed ang Google Calendar sync. Approved pa rin ito sa ComPort; dapat i-check ng admin o lab staff ang calendar configuration.`,
          taglish: `Approved ang reservation ${reservation.reservationCode}, pero ComPort records show na failed ang Google Calendar sync. Approved pa rin ito sa ComPort; admin or lab staff should check the calendar configuration.`
        }),
        suggestions: this.pick(language, {
          english: ["Show my reservations.", "What notifications do I have?"],
          tagalog: ["Ipakita ang reservations ko.", "Ano ang notifications ko?"],
          taglish: ["Show my reservations.", "Ano notifications ko?"]
        })
      };
    }

    return {
      category: "calendar_sync",
      reply: this.pick(language, {
        english: `Reservation ${reservation.reservationCode} is approved in ComPort, but it is not marked as synced to Google Calendar. Current sync status: ${reservation.calendarSyncStatus ?? "NOT_ATTEMPTED"}.`,
        tagalog: `Approved ang reservation ${reservation.reservationCode} sa ComPort, pero hindi ito naka-mark na synced sa Google Calendar. Current sync status: ${reservation.calendarSyncStatus ?? "NOT_ATTEMPTED"}.`,
        taglish: `Approved ang reservation ${reservation.reservationCode} sa ComPort, pero hindi siya marked as synced sa Google Calendar. Current sync status: ${reservation.calendarSyncStatus ?? "NOT_ATTEMPTED"}.`
      }),
      suggestions: this.pick(language, {
        english: ["Show my reservations.", "What is my latest reservation status?"],
        tagalog: ["Ipakita ang reservations ko.", "Ano ang latest reservation status ko?"],
        taglish: ["Show my reservations.", "Ano latest reservation status ko?"]
      })
    };
  }

  formatStaffDirectory(
    language: AssistantLanguage,
    context: StaffDirectoryContextResult
  ): BaseResponse {
    if (!context.users.length) {
      return {
        category: "user_directory",
        reply: this.pick(language, {
          english: "I could not find any active staff or admin records right now.",
          tagalog: "Wala akong makitang active staff o admin records sa ngayon.",
          taglish: "Wala akong makitang active staff or admin records right now."
        }),
        suggestions: this.pick(language, {
          english: ["How many pending reservations?", "What recent actions happened?"],
          tagalog: ["Ilan ang pending reservations?", "Anong recent actions ang nangyari?"],
          taglish: ["How many pending reservations?", "What recent actions happened?"]
        })
      };
    }

    return {
      category: "user_directory",
      reply: this.pick(language, {
        english: "These are the active staff and admin accounts I can confirm from the current system records.",
        tagalog: "Ito ang mga active staff at admin accounts na maiko-confirm ko mula sa current system records.",
        taglish: "Ito ang active staff and admin accounts na ma-confirm ko from the current system records."
      }),
      suggestions: this.pick(language, {
        english: ["How many pending reservations?", "Which reservations need approval?"],
        tagalog: ["Ilan ang pending reservations?", "Aling reservations ang kailangang i-approve?"],
        taglish: ["How many pending reservations?", "Show reservations needing approval."]
      }),
      presentation: {
        type: "user-list",
        title: this.pick(language, {
          english: "Staff and admin directory",
          tagalog: "Staff at admin directory",
          taglish: "Staff and admin directory"
        }),
        users: context.users
      }
    };
  }

  formatLaboratoryLookup(
    language: AssistantLanguage,
    context: LaboratoryLookupResult
  ): BaseResponse {
    const locationText = `${context.laboratory.name} (${context.laboratory.roomCode})`;
    const buildingText = context.laboratory.location
      ? `${context.laboratory.building}, ${context.laboratory.location}`
      : context.laboratory.building;

    return {
      category: "laboratory_lookup",
      reply: this.pick(language, {
        english: `${locationText} is in ${buildingText}. It has a capacity of ${context.laboratory.capacity} and ${context.laboratory.computerCount} computers. Would you like me to check its available schedules too?`,
        tagalog: `${locationText} ay nasa ${buildingText}. May capacity itong ${context.laboratory.capacity} at ${context.laboratory.computerCount} computers. Gusto mo bang tingnan ko rin ang available nitong schedules?`,
        taglish: `${locationText} is located in ${buildingText}. May capacity itong ${context.laboratory.capacity} at ${context.laboratory.computerCount} computers. Gusto mo bang i-check ko rin ang available schedules nito?`
      }),
      suggestions: this.pick(language, {
        english: [`Is ${context.laboratory.roomCode} available tomorrow?`, "What about next week?"],
        tagalog: [`Available ba ang ${context.laboratory.roomCode} bukas?`, "Paano naman sa susunod na linggo?"],
        taglish: [`Available ba ang ${context.laboratory.roomCode} bukas?`, "What about next week?"]
      }),
      presentation: {
        type: "laboratory-details",
        title: this.pick(language, {
          english: "Laboratory details",
          tagalog: "Detalye ng laboratoryo",
          taglish: "Laboratory details"
        }),
        laboratory: {
          name: context.laboratory.name,
          roomCode: context.laboratory.roomCode,
          building: context.laboratory.building,
          location: context.laboratory.location,
          capacity: context.laboratory.capacity,
          computerCount: context.laboratory.computerCount,
          description: context.laboratory.description,
          status: context.laboratory.status
        }
      }
    };
  }

  formatUnmatchedLaboratory(language: AssistantLanguage, suggestions: string[]): BaseResponse {
    return {
      category: "specific_laboratory",
      reply: this.pick(language, {
        english:
          "Sure. Which laboratory would you like me to check? I can filter by the exact room code or laboratory name.",
        tagalog:
          "Sige. Aling laboratoryo ang gusto mong tingnan? Pwede akong mag-filter gamit ang eksaktong room code o laboratory name.",
        taglish:
          "Sure. Aling laboratory ang gusto mong i-check? Pwede kong i-filter by exact room code or laboratory name."
      }),
      suggestions
    };
  }

  formatSpecificLaboratory(
    language: AssistantLanguage,
    laboratory: LaboratorySummary,
    context: ScheduleAvailabilityResult
  ): BaseResponse {
    if (laboratory.status !== "AVAILABLE") {
      return {
        category: "specific_laboratory",
        reply: this.pick(language, {
          english: `${laboratory.name} (${laboratory.roomCode}) is currently marked as ${laboratory.status.toLowerCase()}, so it is not available for reservations right now.`,
          tagalog: `${laboratory.name} (${laboratory.roomCode}) ay kasalukuyang naka-mark na ${laboratory.status.toLowerCase()}, kaya hindi ito available para sa reservation ngayon.`,
          taglish: `${laboratory.name} (${laboratory.roomCode}) is currently marked as ${laboratory.status.toLowerCase()}, kaya hindi siya available for reservation right now.`
        }),
        suggestions: this.pick(language, {
          english: ["What about next week?", "Show all available laboratories."],
          tagalog: ["Paano naman sa susunod na linggo?", "Ipakita ang lahat ng available na laboratories."],
          taglish: ["What about next week?", "Show all available laboratories."]
        })
      };
    }

    if (!context.totalCount) {
      return {
        category: "specific_laboratory",
        reply: this.pick(language, {
          english: `I couldn't find available schedules for ${laboratory.roomCode} in ${context.rangeLabel} based on the current records.`,
          tagalog: `Wala akong nakitang available na schedules para sa ${laboratory.roomCode} sa ${context.rangeLabel} batay sa kasalukuyang records.`,
          taglish: `Wala akong nakita na available schedules for ${laboratory.roomCode} in ${context.rangeLabel} based on the current records.`
        }),
        suggestions: this.pick(language, {
          english: ["What about next week?", "Show all available laboratories for that range."],
          tagalog: [
            "Paano naman sa susunod na linggo?",
            "Ipakita ang lahat ng available na laboratories para sa range na iyon."
          ],
          taglish: ["What about next week?", "Show all available laboratories for that range."]
        })
      };
    }

    return {
      category: "specific_laboratory",
      reply: this.buildScheduleReply(language, context, laboratory.roomCode),
      suggestions: this.scheduleSuggestions(language, context.hasMore, true),
      presentation: this.buildSchedulePresentation(
        language,
        context.schedules,
        context.totalCount,
        context.hasMore,
        laboratory.roomCode
      )
    };
  }

  formatScheduleAvailability(
    language: AssistantLanguage,
    context: ScheduleAvailabilityResult
  ): BaseResponse {
    if (!context.totalCount) {
      return {
        category: "available_schedules",
        reply: this.pick(language, {
          english: `I couldn't find available schedules for ${context.rangeLabel} based on the current records.`,
          tagalog: `Wala akong nakitang available na schedules para sa ${context.rangeLabel} batay sa kasalukuyang records.`,
          taglish: `I couldn't find available schedules for ${context.rangeLabel} based on the current records.`
        }),
        suggestions: this.pick(language, {
          english: ["Show all available laboratories instead.", "Check CL-302 tomorrow."],
          tagalog: [
            "Ipakita na lang ang lahat ng available na laboratories.",
            "Tingnan ang CL-302 bukas."
          ],
          taglish: ["Show all available laboratories instead.", "Check CL-302 tomorrow."]
        })
      };
    }

    return {
      category: "available_schedules",
      reply: this.buildScheduleReply(language, context),
      suggestions: this.scheduleSuggestions(language, context.hasMore, false),
      presentation: this.buildSchedulePresentation(
        language,
        context.schedules,
        context.totalCount,
        context.hasMore
      )
    };
  }

  formatLaboratoryAvailability(
    language: AssistantLanguage,
    context: LaboratoryAvailabilityResult
  ): BaseResponse {
    if (!context.totalCount) {
      return {
        category: "available_laboratories",
        reply: this.pick(language, {
          english: `I couldn't find laboratories with open schedule windows for ${context.rangeLabel}.`,
          tagalog: `Wala akong nakitang laboratories na may open schedule windows para sa ${context.rangeLabel}.`,
          taglish: `Wala akong nakita na laboratories with open schedule windows for ${context.rangeLabel}.`
        }),
        suggestions: this.pick(language, {
          english: ["What about next week?", "Check CL-302 instead."],
          tagalog: ["Paano naman sa susunod na linggo?", "Tingnan na lang ang CL-302."],
          taglish: ["What about next week?", "Check CL-302 instead."]
        })
      };
    }

    return {
      category: "available_laboratories",
      reply: this.pick(language, {
        english: `Here are the laboratories with open schedule windows for ${context.rangeLabel}.`,
        tagalog: `Narito ang mga laboratoryong may open schedule windows para sa ${context.rangeLabel}.`,
        taglish: `Narito ang laboratories na may open schedule windows for ${context.rangeLabel}.`
      }),
      suggestions: context.hasMore
        ? this.pick(language, {
            english: ["Show more", "Filter by CL-302"],
            tagalog: ["Magpakita pa", "I-filter sa CL-302"],
            taglish: ["Show more", "Filter by CL-302"]
          })
        : this.pick(language, {
            english: ["Filter by CL-302", "What about next week?"],
            tagalog: ["I-filter sa CL-302", "Paano naman sa susunod na linggo?"],
            taglish: ["Filter by CL-302", "What about next week?"]
          }),
      presentation: {
        type: "laboratory-results",
        title: this.pick(language, {
          english: "Laboratories with open schedules",
          tagalog: "Mga laboratoryong may open schedules",
          taglish: "Laboratories with open schedules"
        }),
        showingCount: context.laboratories.length,
        totalCount: context.totalCount,
        hasMore: context.hasMore,
        laboratories: context.laboratories
      }
    };
  }

  formatPermissionDenied(
    language: AssistantLanguage,
    message: "admin" | "directory" | "reservation_submitter" | "activity"
  ): BaseResponse {
    const replies = {
      admin: this.pick(language, {
        english:
          "I can help with your own reservations, but whole-system reservation stats are only available to staff or admin accounts.",
        tagalog:
          "Matutulungan kita sa sarili mong reservations, pero ang whole-system reservation stats ay para lang sa staff o admin accounts.",
        taglish:
          "Matutulungan kita sa sarili mong reservations, pero whole-system reservation stats are only available to staff or admin accounts."
      }),
      directory: this.pick(language, {
        english:
          "Staff and admin directory details are only available inside staff or admin workflows.",
        tagalog:
          "Ang staff at admin directory details ay available lang sa staff o admin workflows.",
        taglish:
          "Staff and admin directory details are only available sa staff or admin workflows."
      }),
      reservation_submitter: this.pick(language, {
        english:
          "Reservation submitter details are only available to staff or admin users handling reservation workflows.",
        tagalog:
          "Ang reservation submitter details ay para lang sa staff o admin users na humahawak ng reservation workflows.",
        taglish:
          "Reservation submitter details are only available sa staff or admin users handling reservation workflows."
      }),
      activity: this.pick(language, {
        english: "Recent activity logs are only available to staff or admin users.",
        tagalog: "Ang recent activity logs ay available lang sa staff o admin users.",
        taglish: "Recent activity logs are only available sa staff or admin users."
      })
    };

    return {
      category:
        message === "activity"
          ? "recent_activity"
          : message === "directory"
            ? "user_directory"
            : message === "reservation_submitter"
              ? "reservation_submitter"
              : "admin_stats",
      reply: replies[message],
      suggestions: this.pick(language, {
        english: [
          "What are my reservations today?",
          "Who am I?",
          "What schedules are available this week?"
        ],
        tagalog: [
          "Ano ang reservations ko ngayong araw?",
          "Sino ako?",
          "Anong schedules ang available ngayong linggo?"
        ],
        taglish: [
          "Ano reservation ko ngayon?",
          "Who am I?",
          "What schedules are available this week?"
        ]
      })
    };
  }

  private buildScheduleReply(
    language: AssistantLanguage,
    context: ScheduleAvailabilityResult,
    roomCode?: string
  ) {
    const target = roomCode ? `${roomCode} for ${context.rangeLabel}` : context.rangeLabel;

    if (context.hasMore) {
      return this.pick(language, {
        english: `Here are the available schedules for ${target}. Showing ${context.schedules.length} of ${context.totalCount}. Say "show more" if you'd like the next results.`,
        tagalog: `Narito ang available schedules para sa ${target}. Ipinapakita ang ${context.schedules.length} sa ${context.totalCount}. Sabihin mo lang ang "show more" kung gusto mo pang makita ang susunod na results.`,
        taglish: `Narito ang available schedules for ${target}. Showing ${context.schedules.length} of ${context.totalCount}. Sabihin mo lang ang "show more" kung gusto mo pa ng susunod na results.`
      });
    }

    return this.pick(language, {
      english: `Here are the available schedules for ${target}.`,
      tagalog: `Narito ang available schedules para sa ${target}.`,
      taglish: `Narito ang available schedules for ${target}.`
    });
  }

  private scheduleSuggestions(
    language: AssistantLanguage,
    hasMore: boolean,
    specificLaboratory: boolean
  ) {
    if (hasMore) {
      return this.pick(language, {
        english: [
          "Show more",
          "What about next week?",
          specificLaboratory ? "Show all labs." : "Filter by CL-302"
        ],
        tagalog: [
          "Magpakita pa",
          "Paano naman sa susunod na linggo?",
          specificLaboratory ? "Ipakita ang lahat ng laboratories." : "I-filter sa CL-302"
        ],
        taglish: [
          "Show more",
          "What about next week?",
          specificLaboratory ? "Show all labs." : "Filter by CL-302"
        ]
      });
    }

    return this.pick(language, {
      english: [specificLaboratory ? "Same lab but next week" : "Filter by CL-302", "What about Monday?"],
      tagalog: [
        specificLaboratory ? "Parehong lab pero sa susunod na linggo" : "I-filter sa CL-302",
        "Paano naman sa Monday?"
      ],
      taglish: [specificLaboratory ? "Same lab but next week" : "Filter by CL-302", "What about Monday?"]
    });
  }

  private buildSchedulePresentation(
    language: AssistantLanguage,
    schedules: ScheduleAvailability[],
    totalCount: number,
    hasMore: boolean,
    roomCode?: string
  ): AssistantPresentation {
    const grouped = new Map<
      string,
      Array<{
        laboratoryName: string;
        roomCode: string;
        building: string;
        scheduleWindow: string;
        availableSlots: ScheduleAvailability["freeWindows"];
      }>
    >();

    for (const schedule of schedules) {
      grouped.set(schedule.date, [
        ...(grouped.get(schedule.date) ?? []),
        {
          laboratoryName: schedule.laboratoryName,
          roomCode: schedule.roomCode,
          building: schedule.building,
          scheduleWindow: schedule.scheduleWindow,
          availableSlots: schedule.freeWindows
        }
      ]);
    }

    return {
      type: "schedule-results",
      title: this.pick(language, {
        english: roomCode ? `Available schedules for ${roomCode}` : "Available schedules",
        tagalog: roomCode ? `Available schedules para sa ${roomCode}` : "Available schedules",
        taglish: roomCode ? `Available schedules for ${roomCode}` : "Available schedules"
      }),
      showingCount: schedules.length,
      totalCount,
      hasMore,
      groups: Array.from(grouped.entries()).map(([date, laboratories]) => ({
        date,
        laboratories
      }))
    };
  }

  private roleLabel(role: CurrentUserContextResult["role"] | ActivitySummary["actorRole"]) {
    if (role === "LABORATORY_STAFF") {
      return "Laboratory Staff";
    }

    if (role === "ADMIN") {
      return "Admin";
    }

    return "Student";
  }

  private pick<T>(language: AssistantLanguage, value: { english: T; tagalog: T; taglish: T }) {
    if (language === "tagalog") {
      return value.tagalog;
    }

    if (language === "taglish") {
      return value.taglish;
    }

    return value.english;
  }
}
