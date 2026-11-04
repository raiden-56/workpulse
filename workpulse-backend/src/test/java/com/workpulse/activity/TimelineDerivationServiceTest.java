package com.workpulse.activity;

import com.workpulse.activity.dto.ActivityDtos.TimelineInterval;
import com.workpulse.applications.ApplicationCategory;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

class TimelineDerivationServiceTest {

    private final TimelineDerivationService service = new TimelineDerivationService();
    private final UUID org = UUID.randomUUID();
    private final UUID device = UUID.randomUUID();
    private final UUID employee = UUID.randomUUID();
    private final UUID session = UUID.randomUUID();
    private final Instant dayStart = LocalDate.of(2026, 11, 3).atStartOfDay(ZoneOffset.UTC).toInstant();
    private final Instant dayEnd = dayStart.plusSeconds(86400);

    private static final Function<String, TimelineDerivationService.AppInfo> APPS = process -> switch (process) {
        case "code.exe" -> new TimelineDerivationService.AppInfo("Visual Studio Code", ApplicationCategory.DEVELOPMENT);
        case "chrome.exe" -> new TimelineDerivationService.AppInfo("Google Chrome", ApplicationCategory.NEUTRAL);
        case "ms-teams.exe" -> new TimelineDerivationService.AppInfo("Microsoft Teams", ApplicationCategory.MEETING);
        default -> null;
    };

    @Test
    void derivesExplainedIntervalsFromAWorkingDay() {
        List<ActivityEventRecord> events = new ArrayList<>();
        Instant t0900 = dayStart.plusSeconds(9 * 3600);
        events.add(ev(1, ActivityEventType.SESSION_START, t0900, Map.of()));
        events.add(ev(2, ActivityEventType.FOREGROUND_APP, t0900.plusSeconds(10), Map.of("processName", "code.exe", "durationMs", 25 * 60_000)));
        events.add(ev(3, ActivityEventType.FOREGROUND_APP, t0900.plusSeconds(10 + 25 * 60), Map.of("processName", "chrome.exe", "durationMs", 5 * 60_000)));
        events.add(ev(4, ActivityEventType.IDLE_START, t0900.plusSeconds(31 * 60), Map.of("thresholdSeconds", 300)));
        events.add(ev(5, ActivityEventType.IDLE_END, t0900.plusSeconds(40 * 60), Map.of("idleSeconds", 840)));
        events.add(ev(6, ActivityEventType.FOREGROUND_APP, t0900.plusSeconds(40 * 60 + 10), Map.of("processName", "chrome.exe", "durationMs", 10 * 60_000)));
        events.add(ev(7, ActivityEventType.SESSION_LOCK, t0900.plusSeconds(51 * 60), Map.of()));
        events.add(ev(8, ActivityEventType.SESSION_UNLOCK, t0900.plusSeconds(80 * 60), Map.of()));
        events.add(ev(9, ActivityEventType.FOREGROUND_APP, t0900.plusSeconds(80 * 60 + 10), Map.of("processName", "ms-teams.exe", "durationMs", 39 * 60_000)));
        events.add(ev(10, ActivityEventType.SESSION_END, t0900.plusSeconds(120 * 60), Map.of("reason", "LOGOFF")));

        TimelineDerivationService.Derived derived = service.derive(events, dayStart, dayEnd, dayEnd, APPS);
        List<TimelineInterval> intervals = derived.intervals();

        assertThat(intervals).isNotEmpty();
        assertThat(intervals.get(0).state()).isEqualTo(ActivityState.UNKNOWN);
        assertThat(intervals.get(0).reason()).contains("Signed in");

        TimelineInterval focus = find(intervals, ActivityState.FOCUS_SESSION);
        assertThat(focus.processName()).isEqualTo("code.exe");
        assertThat(focus.durationSeconds()).isEqualTo(25 * 60);
        assertThat(focus.reason()).contains("without idle");

        assertThat(find(intervals, ActivityState.IDLE).durationSeconds()).isEqualTo(9 * 60);
        assertThat(find(intervals, ActivityState.LOCKED).durationSeconds()).isEqualTo(29 * 60);
        TimelineInterval meeting = find(intervals, ActivityState.MEETING);
        assertThat(meeting.appName()).isEqualTo("Microsoft Teams");
        assertThat(meeting.durationSeconds()).isEqualTo(39 * 60 + 50);
        assertThat(intervals.get(intervals.size() - 1).state()).isEqualTo(ActivityState.OFFLINE);

        assertThat(derived.summary().sessionSeconds()).isEqualTo(120 * 60);
        assertThat(derived.summary().focusSeconds()).isEqualTo(25 * 60);
        assertThat(derived.summary().applicationSwitches()).isEqualTo(1);
        assertThat(derived.summary().lockedSeconds()).isEqualTo(29 * 60);
        assertThat(derived.topApplications().get(0).processName()).isEqualTo("ms-teams.exe");
        assertThat(derived.topApplications().get(0).category()).isEqualTo("MEETING");
    }

    @Test
    void longSilenceBecomesUnknownInsteadOfAssumingActivity() {
        Instant t = dayStart.plusSeconds(10 * 3600);
        List<ActivityEventRecord> events = List.of(
                ev(1, ActivityEventType.SESSION_START, t, Map.of()),
                ev(2, ActivityEventType.FOREGROUND_APP, t.plusSeconds(5), Map.of("processName", "code.exe", "durationMs", 60_000)),
                ev(3, ActivityEventType.FOREGROUND_APP, t.plusSeconds(30 * 60), Map.of("processName", "code.exe", "durationMs", 60_000)));

        TimelineDerivationService.Derived derived = service.derive(events, dayStart, dayEnd, t.plusSeconds(31 * 60), APPS);
        TimelineInterval gap = derived.intervals().stream()
                .filter(i -> i.state() == ActivityState.UNKNOWN && i.reason().contains("No agent data"))
                .findFirst().orElseThrow();
        assertThat(gap.durationSeconds()).isEqualTo(30 * 60 - (5 + 60 + 5 * 60));
        long active = derived.summary().activeSeconds() + derived.summary().focusSeconds();
        assertThat(active).isLessThan(15 * 60);
    }

    @Test
    void emptyDayProducesNoIntervals() {
        TimelineDerivationService.Derived derived = service.derive(List.of(), dayStart, dayEnd, dayEnd, APPS);
        assertThat(derived.intervals()).isEmpty();
        assertThat(derived.summary().sessionSeconds()).isZero();
        assertThat(derived.topApplications()).isEmpty();
    }

    private static TimelineInterval find(List<TimelineInterval> intervals, ActivityState state) {
        return intervals.stream().filter(i -> i.state() == state).findFirst().orElseThrow(() -> new AssertionError("no " + state + " in " + intervals));
    }

    private ActivityEventRecord ev(long seq, ActivityEventType type, Instant at, Map<String, Object> payload) {
        return new ActivityEventRecord(seq, org, device, employee, UUID.randomUUID(), type, at, at, seq, session, "1.0.0", payload);
    }
}
