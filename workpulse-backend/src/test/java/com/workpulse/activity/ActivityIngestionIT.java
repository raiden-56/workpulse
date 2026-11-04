package com.workpulse.activity;

import com.fasterxml.jackson.databind.JsonNode;
import com.workpulse.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ActivityIngestionIT extends AbstractIntegrationTest {

    @Test
    void agentRegistersAndBatchesAreIdempotent() {
        OrgFixture org = createOrganization("Vandelay", "vandelay-ingest", "admin@vandelay-ingest.test", "VandelayPassword!123");
        String dept = data(post("/api/v1/departments", Map.of("name", "Imports"), org.adminToken())).path("id").asText();
        String employee = createEmployee(org.adminToken(), "V-001", "Art", "Vandelay", "art@vandelay-ingest.test", dept, null);
        String employeeToken = inviteAndLogin(org.adminToken(), "art@vandelay-ingest.test", "ArtPassword!123", employee,
                List.of(Map.of("roleCode", "EMPLOYEE")));

        // 1. device registration with the employee's user token
        ResponseEntity<JsonNode> registered = post("/api/v1/agent/register", Map.of(
                "hostname", "VD-LT-001", "machineId", "machine-" + UUID.randomUUID(), "osName", "Windows 11",
                "osVersion", "10.0.26100", "agentVersion", "1.0.0"), employeeToken);
        assertThat(registered.getStatusCode().value()).as(String.valueOf(registered.getBody())).isEqualTo(201);
        JsonNode reg = data(registered);
        String deviceId = reg.path("deviceId").asText();
        String deviceToken = reg.path("deviceToken").asText();
        assertThat(reg.path("status").asText()).isEqualTo("APPROVED");
        assertThat(reg.path("policy").path("samplingIntervalSeconds").asInt()).isGreaterThan(0);

        // 2. heartbeat with the device token
        ResponseEntity<JsonNode> heartbeat = call(HttpMethod.POST, "/api/v1/agent/heartbeat",
                Map.of("agentVersion", "1.0.0", "queueDepth", 0, "collectorConnected", true), null, Map.of("X-Device-Token", deviceToken));
        assertThat(heartbeat.getStatusCode().value()).isEqualTo(200);
        assertThat(data(heartbeat).path("deviceStatus").asText()).isEqualTo("APPROVED");

        // 3. first batch is accepted
        Instant start = Instant.now().minusSeconds(600);
        UUID sessionId = UUID.randomUUID();
        List<Map<String, Object>> events = List.of(
                event(UUID.randomUUID(), 1, "SESSION_START", start, sessionId, Map.of("windowsUser", "VD\\art")),
                event(UUID.randomUUID(), 2, "FOREGROUND_APP", start.plusSeconds(10), sessionId,
                        Map.of("processName", "Code.exe", "appName", "Visual Studio Code", "pid", 4242, "durationMs", 300000)));
        Map<String, Object> batch = Map.of("batchId", UUID.randomUUID(), "agentVersion", "1.0.0", "sentAt", Instant.now(), "events", events);
        ResponseEntity<JsonNode> first = call(HttpMethod.POST, "/api/v1/activity/batch", batch, null, Map.of("X-Device-Token", deviceToken));
        assertThat(first.getStatusCode().value()).as(String.valueOf(first.getBody())).isEqualTo(200);
        assertThat(data(first).path("accepted").asInt()).isEqualTo(2);
        assertThat(data(first).path("duplicates").asInt()).isZero();

        // 4. retrying the same batch is harmless
        ResponseEntity<JsonNode> retry = call(HttpMethod.POST, "/api/v1/activity/batch", batch, null, Map.of("X-Device-Token", deviceToken));
        assertThat(retry.getStatusCode().value()).isEqualTo(200);
        assertThat(data(retry).path("accepted").asInt()).isZero();
        assertThat(data(retry).path("duplicates").asInt()).isEqualTo(2);

        // 5. forbidden content is rejected, never stored
        Map<String, Object> forbidden = Map.of("batchId", UUID.randomUUID(), "events", List.of(
                event(UUID.randomUUID(), 3, "INPUT_SUMMARY", Instant.now(), sessionId, Map.of("keystrokes", "hunter2"))));
        JsonNode rejected = data(call(HttpMethod.POST, "/api/v1/activity/batch", forbidden, null, Map.of("X-Device-Token", deviceToken)));
        assertThat(rejected.path("accepted").asInt()).isZero();
        assertThat(rejected.path("rejected").get(0).path("reason").asText()).startsWith("FORBIDDEN_CONTENT");

        // 6. live status and timeline reflect the events
        JsonNode live = data(get("/api/v1/activity/live", org.adminToken()));
        JsonNode row = null;
        for (JsonNode n : live) {
            if (n.path("employeeId").asText().equals(employee)) {
                row = n;
            }
        }
        assertThat(row).isNotNull();
        assertThat(row.path("status").asText()).isEqualTo("ACTIVE_APPLICATION");
        assertThat(row.path("foregroundApp").asText()).isEqualTo("Visual Studio Code");
        assertThat(row.path("reason").asText()).contains("foreground");

        JsonNode timeline = data(get("/api/v1/activity/timeline?employeeId=" + employee, org.adminToken()));
        assertThat(timeline.path("intervals").size()).isGreaterThanOrEqualTo(2);
        assertThat(timeline.path("summary").path("activeSeconds").asLong() + timeline.path("summary").path("focusSeconds").asLong()).isGreaterThan(0);
        assertThat(timeline.path("topApplications").get(0).path("processName").asText()).isEqualTo("code.exe");

        // the employee can see their own timeline and dashboard
        assertThat(get("/api/v1/activity/timeline", employeeToken).getStatusCode().value()).isEqualTo(200);
        JsonNode mine = data(get("/api/v1/dashboard/me", employeeToken));
        assertThat(mine.path("hasEmployeeProfile").asBoolean()).isTrue();
        assertThat(mine.path("status").path("status").asText()).isEqualTo("ACTIVE_APPLICATION");

        JsonNode overview = data(get("/api/v1/dashboard/overview", org.adminToken()));
        assertThat(overview.path("presence").path("activeApplication").asLong()).isEqualTo(1);
        assertThat(overview.path("topApplications").get(0).path("processName").asText()).isEqualTo("code.exe");
        assertThat(overview.path("engagement").path("developmentSeconds").asLong()).isEqualTo(300);

        // 7. revoking the device blocks further ingestion
        assertThat(post("/api/v1/devices/" + deviceId + "/revoke", null, org.adminToken()).getStatusCode().value()).isEqualTo(200);
        ResponseEntity<JsonNode> afterRevoke = call(HttpMethod.POST, "/api/v1/activity/batch", batch, null, Map.of("X-Device-Token", deviceToken));
        assertThat(afterRevoke.getStatusCode().value()).isEqualTo(401);
        assertThat(errorCode(afterRevoke)).isEqualTo("UNAUTHORIZED");
    }

    @Test
    void userTokensCannotIngestAndUnknownDeviceTokensAreRejected() {
        OrgFixture org = createOrganization("Dunder Mifflin", "dunder-ingest", "admin@dunder-ingest.test", "DunderPassword!123");
        Map<String, Object> batch = Map.of("batchId", UUID.randomUUID(), "events", List.of(
                event(UUID.randomUUID(), 1, "SESSION_START", Instant.now(), UUID.randomUUID(), Map.of())));
        assertThat(post("/api/v1/activity/batch", batch, org.adminToken()).getStatusCode().value()).isEqualTo(403);
        ResponseEntity<JsonNode> unknown = call(HttpMethod.POST, "/api/v1/activity/batch", batch, null, Map.of("X-Device-Token", "nope"));
        assertThat(unknown.getStatusCode().value()).isEqualTo(401);
    }

    private static Map<String, Object> event(UUID id, long seq, String type, Instant at, UUID sessionId, Map<String, Object> payload) {
        Map<String, Object> e = new HashMap<>();
        e.put("eventId", id);
        e.put("sequence", seq);
        e.put("type", type);
        e.put("occurredAt", at);
        e.put("sessionId", sessionId);
        e.put("payload", payload);
        return e;
    }
}
