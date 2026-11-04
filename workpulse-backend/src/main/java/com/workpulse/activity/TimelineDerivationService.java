package com.workpulse.activity;

import com.workpulse.activity.dto.ActivityDtos.AppUsage;
import com.workpulse.activity.dto.ActivityDtos.TimelineInterval;
import com.workpulse.activity.dto.ActivityDtos.TimelineSummary;
import com.workpulse.applications.ApplicationCategory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Pure, deterministic derivation of a day's activity intervals from raw agent events.
 * Every interval carries the reason it was classified the way it was.
 */
@Service
public class TimelineDerivationService {

    /** Gap after the last event beyond which we stop assuming the previous state continues. */
    static final Duration MAX_CONTINUATION = Duration.ofMinutes(5);
    static final Duration FOCUS_THRESHOLD = Duration.ofMinutes(25);

    public record Derived(List<TimelineInterval> intervals, TimelineSummary summary, List<AppUsage> topApplications) {}

    public record AppInfo(String displayName, ApplicationCategory category) {}

    public Derived derive(List<ActivityEventRecord> rawEvents, Instant windowStart, Instant windowEnd, Instant now,
                          Function<String, AppInfo> appLookup) {
        Instant end = windowEnd.isBefore(now) ? windowEnd : now;
        List<ActivityEventRecord> events = new ArrayList<>(rawEvents);
        events.sort(Comparator.comparing(ActivityEventRecord::occurredAt).thenComparing(e -> e.sequence() == null ? Long.MAX_VALUE : e.sequence()));

        List<Segment> segments = new ArrayList<>();
        Segment current = null;
        int switches = 0;
        Instant first = null;
        Instant last = null;

        for (ActivityEventRecord event : events) {
            Instant at = event.occurredAt();
            if (at.isBefore(windowStart) || !at.isBefore(end)) {
                continue;
            }
            if (first == null) first = at;
            last = at;

            if (current != null && Duration.between(current.lastEvent, at).compareTo(MAX_CONTINUATION) > 0
                    && (current.state == ActivityState.ACTIVE_APPLICATION || current.state == ActivityState.MEETING
                    || current.state == ActivityState.FOCUS_SESSION)) {
                // engagement cannot be assumed across a long silence; idle, locked, break and offline are
                // explicit states bracketed by their own events and simply continue
                current.end = current.lastEvent.plus(MAX_CONTINUATION);
                segments.add(current);
                Segment gap = new Segment(ActivityState.UNKNOWN, current.end, "No agent data received", null, null, null);
                gap.lastEvent = at;
                gap.end = at;
                segments.add(gap);
                current = null;
            }

            switch (event.eventType()) {
                case SESSION_START -> current = open(segments, current, at, ActivityState.UNKNOWN, "Signed in to Windows", null, null, null);
                case SESSION_END, AGENT_STOPPED -> current = open(segments, current, at, ActivityState.OFFLINE,
                        event.eventType() == ActivityEventType.SESSION_END ? "Signed out of Windows" : "Agent stopped", null, null, null);
                case SESSION_LOCK -> current = open(segments, current, at, ActivityState.LOCKED, "Workstation locked", null, null, null);
                case SESSION_UNLOCK -> current = open(segments, current, at, ActivityState.UNKNOWN, "Workstation unlocked", null, null, null);
                case IDLE_START -> current = open(segments, current, at, ActivityState.IDLE,
                        "No input for " + event.payloadLong("thresholdSeconds", 300) / 60 + " min", null, null, null);
                case IDLE_END -> current = open(segments, current, at, ActivityState.UNKNOWN, "Input resumed", null, null, null);
                case BREAK_START -> current = open(segments, current, at, ActivityState.BREAK, "Employee-declared break", null, null, null);
                case BREAK_END -> current = open(segments, current, at, ActivityState.UNKNOWN, "Break ended", null, null, null);
                case FOREGROUND_APP -> {
                    String process = event.payloadString("processName");
                    if (process == null) {
                        break;
                    }
                    process = process.toLowerCase();
                    AppInfo info = appLookup.apply(process);
                    String appName = info == null || info.displayName() == null ? defaultName(event.payloadString("appName"), process) : info.displayName();
                    ApplicationCategory category = info == null ? ApplicationCategory.NEUTRAL : info.category();
                    if (current != null && (current.state == ActivityState.LOCKED || current.state == ActivityState.BREAK)) {
                        current.lastEvent = at;
                        break;
                    }
                    ActivityState target = category == ApplicationCategory.MEETING ? ActivityState.MEETING : ActivityState.ACTIVE_APPLICATION;
                    if (current != null && current.process != null && current.process.equals(process)
                            && (current.state == target)) {
                        current.lastEvent = at.plusMillis(event.payloadLong("durationMs", 0));
                    } else {
                        if (current != null && current.process != null && (current.state == ActivityState.ACTIVE_APPLICATION || current.state == ActivityState.MEETING)) {
                            switches++;
                        }
                        current = open(segments, current, at, target,
                                target == ActivityState.MEETING ? appName + " (meeting application)" : appName + " in the foreground",
                                process, appName, category.name());
                        current.lastEvent = at.plusMillis(event.payloadLong("durationMs", 0));
                    }
                }
                default -> { if (current != null) current.lastEvent = at; }
            }
        }
        if (current != null) {
            Instant cap = current.state == ActivityState.OFFLINE ? end : minInstant(end, current.lastEvent.plus(MAX_CONTINUATION));
            current.end = cap.isAfter(current.start) ? cap : current.start;
            segments.add(current);
        }

        // Promote long uninterrupted single-application blocks to focus sessions.
        for (Segment s : segments) {
            if (s.state == ActivityState.ACTIVE_APPLICATION && Duration.between(s.start, s.end).compareTo(FOCUS_THRESHOLD) >= 0) {
                s.state = ActivityState.FOCUS_SESSION;
                s.reason = s.appName + " in the foreground for " + Duration.between(s.start, s.end).toMinutes() + " min without idle or switching";
            }
        }

        List<TimelineInterval> intervals = new ArrayList<>();
        long session = 0, active = 0, focus = 0, meeting = 0, idle = 0, brk = 0, locked = 0, unknown = 0;
        Map<String, long[]> perApp = new LinkedHashMap<>();
        Map<String, AppUsage> appMeta = new LinkedHashMap<>();
        for (Segment s : segments) {
            long seconds = Math.max(0, Duration.between(s.start, s.end).getSeconds());
            if (seconds == 0 && s.state != ActivityState.OFFLINE) {
                continue;
            }
            intervals.add(new TimelineInterval(s.start, s.end, seconds, s.state, s.process, s.appName, s.category, s.reason));
            switch (s.state) {
                case ACTIVE_APPLICATION -> active += seconds;
                case FOCUS_SESSION -> focus += seconds;
                case MEETING -> meeting += seconds;
                case IDLE -> idle += seconds;
                case BREAK -> brk += seconds;
                case LOCKED -> locked += seconds;
                case UNKNOWN -> unknown += seconds;
                default -> { }
            }
            if (s.state != ActivityState.OFFLINE) {
                session += seconds;
            }
            if (s.process != null) {
                perApp.computeIfAbsent(s.process, k -> new long[1])[0] += seconds;
                appMeta.putIfAbsent(s.process, new AppUsage(s.process, s.appName, s.category, 0));
            }
        }
        List<AppUsage> top = perApp.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue()[0], a.getValue()[0]))
                .limit(10)
                .map(e -> { AppUsage m = appMeta.get(e.getKey()); return new AppUsage(m.processName(), m.appName(), m.category(), e.getValue()[0]); })
                .toList();
        TimelineSummary summary = new TimelineSummary(session, active, focus, meeting, idle, brk, locked, unknown, first, last, switches);
        return new Derived(intervals, summary, top);
    }

    private static Segment open(List<Segment> segments, Segment current, Instant at, ActivityState state, String reason,
                                String process, String appName, String category) {
        if (current != null) {
            current.end = at.isAfter(current.start) ? at : current.start;
            segments.add(current);
        }
        Segment s = new Segment(state, at, reason, process, appName, category);
        s.lastEvent = at;
        return s;
    }

    private static String defaultName(String appName, String process) {
        return appName == null || appName.isBlank() ? process : appName;
    }

    private static Instant minInstant(Instant a, Instant b) {
        return a.isBefore(b) ? a : b;
    }

    private static final class Segment {
        ActivityState state;
        Instant start;
        Instant end;
        Instant lastEvent;
        String reason;
        final String process;
        final String appName;
        final String category;

        Segment(ActivityState state, Instant start, String reason, String process, String appName, String category) {
            this.state = state;
            this.start = start;
            this.reason = reason;
            this.process = process;
            this.appName = appName;
            this.category = category;
        }
    }
}
