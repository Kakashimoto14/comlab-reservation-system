import type {
  AssistantLanguage,
  AssistantPresentation,
  DateRange,
  GeneralHelpContext,
  LaboratoryAvailabilityResult,
  LaboratoryLookupResult,
  LaboratorySummary,
  ReservationAssistantResponse,
  ReservationResultsContext,
  ReservationRule,
  ScheduleAvailability,
  ScheduleAvailabilityResult
} from "./types.js";

type BaseResponse = Omit<ReservationAssistantResponse, "mode">;

export class ResponseFormatter {
  formatOutOfScope(language: AssistantLanguage): BaseResponse {
    return {
      category: "out_of_scope",
      reply: this.pick(language, {
        english:
          "I can help with ComPort / ComLab reservations, schedules, laboratories, and reservation status. If you want, I can check available schedules or your reservations.",
        tagalog:
          "Makakatulong ako sa mga reservation, schedule, laboratoryo, at reservation status sa ComPort / ComLab. Kung gusto mo, pwede kong tingnan ang available na schedules o ang mga reservation mo.",
        taglish:
          "ComPort Assistant lang ako for ComPort / ComLab reservations, schedules, laboratories, at reservation status. Kung gusto mo, pwede kitang tulungan mag-check ng available schedule o reservation mo."
      }),
      suggestions: this.pick(language, {
        english: [
          "What schedules are available next week?",
          "Is CL-302 available tomorrow?",
          "Show my reservations for this week."
        ],
        tagalog: [
          "Anong schedules ang available sa susunod na linggo?",
          "Available ba ang CL-302 bukas?",
          "Ipakita ang reservations ko ngayong linggo."
        ],
        taglish: [
          "May schedule ba next month?",
          "Available ba ang CL-302 bukas?",
          "Ano reservation ko ngayon?"
        ]
      })
    };
  }

  formatGeneralHelp(language: AssistantLanguage, context: GeneralHelpContext): BaseResponse {
    return {
      category: "general_reservation_help",
      reply: this.pick(language, {
        english: `Hi! I can help with schedules, laboratory availability, reservation status, and reservation rules. In ${context.rangeLabel}, the system currently shows ${context.availableLaboratories} available laboratories and ${context.scheduleCount} published schedule blocks.`,
        tagalog: `Kamusta! Matutulungan kita sa schedules, availability ng laboratoryo, reservation status, at reservation rules. Para sa ${context.rangeLabel}, may ${context.availableLaboratories} available na laboratoryo at ${context.scheduleCount} published schedule blocks sa system.`,
        taglish: `Hi! Pwede kitang tulungan sa schedules, laboratory availability, reservation status, at reservation rules. Sa ${context.rangeLabel}, may ${context.availableLaboratories} laboratories na available at ${context.scheduleCount} published schedule blocks sa system.`
      }),
      suggestions: this.pick(language, {
        english: [
          "What schedules are available this week?",
          "Which laboratories are available today?",
          "Show my reservations."
        ],
        tagalog: [
          "Anong schedules ang available ngayong linggo?",
          "Aling laboratories ang available ngayon?",
          "Ipakita ang reservations ko."
        ],
        taglish: [
          "May schedule ba this week?",
          "Available ba ang CL-302 bukas?",
          "Ano reservation ko?"
        ]
      })
    };
  }

  formatRules(language: AssistantLanguage, rules: ReservationRule[]): BaseResponse {
    return {
      category: "reservation_rules",
      reply: this.pick(language, {
        english: "These are the reservation rules I can verify from the current system records.",
        tagalog: "Ito ang mga reservation rules na na-verify ko mula sa kasalukuyang system records.",
        taglish: "Ito ang reservation rules na verified ko from the current system records."
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
    range: DateRange
  ): BaseResponse {
    if (!context.reservations.length) {
      return {
        category: "my_reservations",
        reply: this.pick(language, {
          english: `I couldn't find any of your reservations for ${context.rangeLabel} in the current records.`,
          tagalog: `Wala akong nakitang reservations mo para sa ${context.rangeLabel} sa kasalukuyang records.`,
          taglish: `Wala akong nakita na reservations mo for ${context.rangeLabel} sa current records.`
        }),
        suggestions: this.pick(language, {
          english: [
            "Show my reservations this week.",
            "Is the multimedia lab available tomorrow?"
          ],
          tagalog: [
            "Ipakita ang reservations ko ngayong linggo.",
            "Available ba ang multimedia lab bukas?"
          ],
          taglish: ["Ano reservation ko this week?", "Available ba ang multimedia lab bukas?"]
        })
      };
    }

    return {
      category: "my_reservations",
      reply: this.pick(language, {
        english: `Here are your reservations for ${context.rangeLabel}.`,
        tagalog: `Narito ang mga reservation mo para sa ${context.rangeLabel}.`,
        taglish: `Ito ang reservations mo for ${context.rangeLabel}.`
      }),
      suggestions:
        range.granularity === "day"
          ? this.pick(language, {
              english: ["What about next week?", "What are the reservation rules?"],
              tagalog: [
                "Paano naman sa susunod na linggo?",
                "Ano ang reservation rules?"
              ],
              taglish: ["Paano naman next week?", "Ano rules ng reservation?"]
            })
          : this.pick(language, {
              english: ["Show my reservations tomorrow.", "Is CL-302 available?"],
              tagalog: ["Ipakita ang reservations ko bukas.", "Available ba ang CL-302?"],
              taglish: ["Ano reservation ko bukas?", "May available ba sa CL-302?"]
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
        english: `${locationText} is in ${buildingText}. Would you like me to check its available schedules too?`,
        tagalog: `${locationText} ay nasa ${buildingText}. Gusto mo bang tingnan ko rin ang available nitong schedules?`,
        taglish: `${locationText} is located in ${buildingText}. Gusto mo bang i-check ko rin ang available schedules nito?`
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

  private pick<T>(
    language: AssistantLanguage,
    value: { english: T; tagalog: T; taglish: T }
  ) {
    if (language === "tagalog") {
      return value.tagalog;
    }

    if (language === "taglish") {
      return value.taglish;
    }

    return value.english;
  }
}
