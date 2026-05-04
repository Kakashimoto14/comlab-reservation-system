# Title Page

**Title:** ComPort: The ComLab Reservation System for ICS Students of Colegio de Montalban

**Author(s):** [Insert author name(s)]

**Keywords:** computer laboratory reservation, web-based system, schedule management, role-based access, reservation workflow, campus information system

**Corresponding Author:** [Insert full name, affiliation, and email address]

**Financial & Equipment Support:** No external financial support was declared. The project was developed using standard development tools, a MySQL database, Prisma ORM, and the existing college laboratory workflow as the implementation context.

**Conflicts of Interest:** None declared.

# Abstract

**Introduction:** Computer laboratory reservations in academic settings are often handled through manual coordination, which can lead to overlapping schedules, limited visibility of room availability, delayed approvals, and incomplete activity records.  
**Objective:** This project aimed to design and implement ComPort, a web-based reservation and management system for the computer laboratories of the Institute of Computer Studies at Colegio de Montalban.  
**Methods:** The project used a descriptive-developmental software engineering approach. The system was built as a full-stack web application with role-based access for students, laboratory staff, and administrators. Key modules include authentication, laboratory and schedule management, reservation workflows, PC-level booking, calendar management, reporting, notifications, and activity logging.  
**Results:** The completed system provides students with laboratory browsing and reservation capabilities, staff with schedule and reservation oversight, and administrators with broader control over users, laboratories, calendar events, and reports. The data model supports laboratories, schedules, reservations, PCs, calendar events, notifications, password reset tokens, and audit logs. Conflict prevention is handled through schedule validation and booking rules, while dashboard views and CSV exports support operational monitoring.  
**Conclusion:** ComPort centralizes laboratory reservation and monitoring tasks into one platform and is aligned with the needs of ICS laboratory operations. The system improves visibility, traceability, and role-based control compared with a manual reservation process.

# Introduction

Computer laboratories are a core resource for Information and Communication Technology instruction, but access to these rooms is difficult to manage when reservation requests, approvals, and schedule changes are handled manually. In a paper-based setup, users may not immediately see whether a room is available, staff may have to reconcile conflicting bookings by hand, and administrators may have limited visibility over room utilization, maintenance schedules, and reservation history.

For the Institute of Computer Studies at Colegio de Montalban, these limitations create practical problems in day-to-day laboratory coordination. Students need a clear way to request reservations, laboratory staff need a reliable way to review and manage schedules, and administrators need a centralized view of the entire laboratory operation. A single system that supports authentication, role-based access, room management, schedule locking, reservation approval, and reporting is therefore useful for improving efficiency and accountability.

ComPort was developed to address these needs. It is a web-based reservation system that allows students to browse laboratories, choose an available schedule, and request either a whole-laboratory reservation or a specific PC reservation. Laboratory staff and administrators can manage laboratories, maintain schedules, review reservations, monitor activity, and generate reports. The project is intended to replace fragmented or manual coordination with a more organized and auditable workflow.

# Methods

## Context and Setting of the Study

This project was developed for the computer laboratory environment of the Institute of Computer Studies at Colegio de Montalban. The operational context includes students who request laboratory access, laboratory staff who manage room availability and reservation approvals, and administrators who oversee users, laboratories, schedules, calendar blocks, and reports.

## Study Design

The project followed a descriptive-developmental software design. Rather than testing a medical or behavioral intervention, the work focused on planning, building, and validating a functional information system that automates laboratory reservation and management workflows.

## Population

The intended user population consists of:

1. ICS students who request reservations.
2. Laboratory staff who manage schedules, review requests, and monitor room usage.
3. Administrators who manage system users, laboratory records, calendar events, and reports.

## Sampling Strategy

No probabilistic sampling strategy was used because this is a system development project rather than a population survey. User roles and workflow requirements were derived from the operational needs of the laboratory environment and encoded into the system design.

## Intervention

The intervention was the implementation of ComPort as a centralized reservation and management platform. The system includes:

1. Student registration and secure login.
2. Role-based dashboards for students, laboratory staff, and administrators.
3. Laboratory management with custodian assignment and laboratory images.
4. Schedule management with overlap prevention.
5. Reservation creation for either whole-laboratory or PC-specific bookings.
6. Reservation review, approval, rejection, cancellation, and completion workflows.
7. Management calendar features for maintenance and holiday blocking.
8. Reporting and CSV export for reservation analysis.
9. Activity logging and password reset support.

## Main Study Variables

The main system outcomes of interest were:

1. Reservation efficiency.
2. Schedule conflict prevention.
3. Role-based access control.
4. Visibility of laboratory availability.
5. Traceability of reservation decisions and user actions.
6. Reporting usefulness for operational oversight.

## Data Collection Instruments and Procedures

This paper is based on the completed codebase, database schema, API structure, and user interface modules of the project. The implementation uses a MySQL database with Prisma as the ORM, Express and Node.js on the backend, and React with Vite on the frontend. The system schema includes users, laboratories, schedules, reservations, PCs, calendar events, notifications, password reset tokens, and activity logs.

During development, requirements were translated into backend validations, service logic, route definitions, and frontend pages. Functional modules were organized by role so that students, staff, and administrators only access the actions relevant to them.

## Outline of Analysis Methods

The analysis was descriptive and implementation-based. System behavior was examined through:

1. Feature-to-requirement matching.
2. Review of role-based workflow coverage.
3. Inspection of reservation conflict rules and schedule validation logic.
4. Verification of reporting, logging, and calendar capabilities.

Because the repository does not contain a formal user-satisfaction survey or experimental comparison group, the Results section focuses on implemented functionality rather than inferential statistical findings.

# Results

The project produced a working web-based reservation system with separate experiences for students, laboratory staff, and administrators.

Students can register, log in, browse laboratories, view weekly availability, and submit reservation requests. The reservation form supports two modes: reserving the whole laboratory or reserving a specific PC. The booking workflow checks the selected schedule, validates the time range, and prevents overlapping reservations.

Laboratory staff can manage laboratory records, review reservation requests, monitor reservation status, and generate reports. The staff interface includes summary cards, reservation filters, charts, and CSV export to support day-to-day oversight.

Administrators have broader control over the system. They can manage users, assign staff to laboratories, maintain laboratory records, and use a management calendar to create maintenance blocks and holiday blocks. The calendar view merges custom calendar entries with derived items from schedules and reservations, giving the administrator a single operational view of laboratory activity.

The backend schema supports the main operational requirements of the system. Important entities include:

1. User accounts with role and status fields.
2. Laboratory records with capacity, computer count, custodian assignment, and image support.
3. Schedules with date and time boundaries.
4. Reservations with approval status, reviewer information, and optional PC assignment.
5. Activity logs for accountability.
6. Notifications and password reset tokens for account management and reminders.

The system also includes automated tests, health-check support, rate limiting, and production-oriented configuration handling. These features strengthen the reliability of the application and make it more suitable for deployment and demonstration.

# Discussion

ComPort addresses the major weaknesses of manual laboratory reservation by consolidating scheduling, approval, monitoring, and reporting into one platform. The most important contribution of the system is not only the ability to create reservations, but also the way it structures the workflow around role-based permissions and conflict prevention. This reduces the chance of duplicate bookings and makes it easier for staff and administrators to see the current status of laboratories and reservations.

The project is consistent with the general direction of existing laboratory management systems, which typically emphasize centralized access, digital scheduling, and better accountability. Compared with manual logbooks or informal coordination, ComPort provides a clearer audit trail through reservation records, activity logs, reviewer data, and calendar events. The reporting tools also add practical value because they help staff identify reservation patterns and laboratory demand.

The system has several strengths. It separates concerns cleanly across backend services, frontend pages, and database models. It supports multiple user roles without exposing unnecessary actions to each role. It also includes PC-level reservation support, which is more flexible than a room-only booking model.

The main limitation is that this draft does not report a formal field experiment or statistically analyzed user survey. As a result, the paper can confidently describe the implemented capabilities, but it cannot claim measured improvements in user satisfaction or processing time unless a separate evaluation study is conducted. Another practical limitation is that email-based notification features depend on external SMTP configuration.

For future work, the project could include a formal usability study, automated reminder benchmarking, QR-based attendance or sign-in support, deeper analytics, and mobile-friendly enhancements for faster access on campus devices.

# Conclusions

ComPort is a functional web-based reservation system that centralizes computer laboratory scheduling, approval, monitoring, and reporting for the Institute of Computer Studies at Colegio de Montalban. The system improves visibility over laboratory availability, supports role-based control, and helps reduce reservation conflicts. Its design is appropriate for academic laboratory operations and provides a strong foundation for future evaluation and feature expansion.

# Acknowledgements

The authors acknowledge the faculty advisers, laboratory staff, and student stakeholders who helped define the project requirements and validate the workflow assumptions. Permission should be obtained before listing any individual by name in this section.

# References

Adewasi, D. (2021, June 14). What is IMRaD? IMRaD format in simple terms! Scientific-editing.info.

Cuschieri, S., Grech, V., & Savona-Ventura, C. (2019). WASP (Write a scientific paper): Structuring a scientific paper. *Early Human Development, 128*, 114-117. https://doi.org/10.1016/j.earlhumdev.2018.09.011

Nair, P. K. R., & Nair, V. D. (2014). Organization of a research paper: The IMRAD format. In *Scientific Writing and Communication in Agriculture and Natural Resources*. Springer. https://doi.org/10.1007/978-3-319-03101-9_2

Sollaci, L. B., & Pereira, M. G. (2004). The introduction, methods, results, and discussion (IMRAD) structure: A fifty-year survey. *Journal of the Medical Library Association, 92*(3), 364-367.
