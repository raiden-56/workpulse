package com.workpulse.guest;

import com.fasterxml.jackson.databind.JsonNode;
import com.workpulse.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@TestPropertySource(properties = {
        "workpulse.demo.enabled=true",
        "workpulse.demo.employee-count=12",
        "workpulse.demo.seed-days=3"
})
class GuestModeIT extends AbstractIntegrationTest {

    @Test
    void publicGuestCanExploreTheDemoOrganisationReadOnly() {
        JsonNode config = data(get("/api/v1/guest/config", null));
        assertThat(config.path("enabled").asBoolean()).isTrue();
        assertThat(config.path("personas").size()).isGreaterThanOrEqualTo(5);
        assertThat(config.path("notice").asText()).contains("simulated");

        ResponseEntity<JsonNode> session = post("/api/v1/guest/sessions", Map.of("persona", "EXECUTIVE"), null);
        assertThat(session.getStatusCode().value()).isEqualTo(201);
        JsonNode tokens = data(session);
        String token = tokens.path("accessToken").asText();
        assertThat(tokens.path("user").path("guestType").asText()).isEqualTo("DEMO");
        assertThat(tokens.path("user").path("demoOrganization").asBoolean()).isTrue();
        assertThat(tokens.path("user").path("guestPersona").asText()).isEqualTo("EXECUTIVE");

        JsonNode overview = data(get("/api/v1/dashboard/overview", token));
        assertThat(overview.path("demo").asBoolean()).isTrue();
        assertThat(overview.path("headcount").path("total").asLong()).isEqualTo(12);
        assertThat(overview.path("topApplications").size()).isGreaterThan(0);
        assertThat(overview.path("daily").size()).isGreaterThan(0);

        assertThat(data(get("/api/v1/employees?size=50", token)).size()).isEqualTo(12);
        assertThat(get("/api/v1/activity/live", token).getStatusCode().value()).isEqualTo(200);
        assertThat(get("/api/v1/devices", token).getStatusCode().value()).isEqualTo(200);
        assertThat(get("/api/v1/policies", token).getStatusCode().value()).isEqualTo(200);
        assertThat(get("/api/v1/audit-logs", token).getStatusCode().value()).isEqualTo(200);

        // read-only, even though the role carries view permissions
        ResponseEntity<JsonNode> write = post("/api/v1/departments", Map.of("name", "Nope"), token);
        assertThat(write.getStatusCode().value()).isEqualTo(403);
        assertThat(get("/api/v1/auth/me", token).getStatusCode().value()).isEqualTo(200);

        assertThat(delete("/api/v1/guest/sessions/current", token).getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void employeePersonaGetsAPersonalDashboard() {
        String token = data(post("/api/v1/guest/sessions", Map.of("persona", "EMPLOYEE"), null)).path("accessToken").asText();
        JsonNode me = data(get("/api/v1/dashboard/me", token));
        assertThat(me.path("hasEmployeeProfile").asBoolean()).isTrue();
        assertThat(me.path("employee").path("employeeCode").asText()).isEqualTo(DemoDataSeeder.PERSONA_EMPLOYEE_CODE);
        assertThat(me.path("policy").path("samplingIntervalSeconds").asInt()).isGreaterThan(0);
    }

    @org.springframework.beans.factory.annotation.Autowired
    private DemoActivitySimulator simulator;

    @Test
    void simulatorKeepsTheDemoWorkforceAliveDuringWorkingHours() {
        java.time.ZoneId zone = java.time.ZoneId.of("Asia/Kolkata");
        java.time.LocalDate day = java.time.LocalDate.now(zone).plusDays(1);
        while (day.getDayOfWeek() == java.time.DayOfWeek.SATURDAY || day.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) {
            day = day.plusDays(1);
        }
        int produced = 0;
        for (int minute = 0; minute < 8; minute++) {
            produced += simulator.simulate(day.atTime(9, 30 + minute).atZone(zone));
        }
        produced += simulator.simulate(day.atTime(11, 0).atZone(zone));
        assertThat(produced).isGreaterThan(0);

        String token = login("demo.admin@workpulse.demo", DemoDataSeeder.DEMO_PASSWORD)[0];
        JsonNode summary = data(get("/api/v1/activity/live/summary", token));
        long offline = summary.path("byStatus").path("OFFLINE").asLong();
        assertThat(offline).isLessThan(summary.path("total").asLong());

        // after hours everybody eventually signs off
        for (int i = 0; i < 12; i++) {
            simulator.simulate(day.atTime(21, i).atZone(zone));
        }
        JsonNode evening = data(get("/api/v1/activity/live/summary", token));
        assertThat(evening.path("byStatus").path("OFFLINE").asLong()).isGreaterThan(offline);
    }

    @Test
    void demoRoleAccountsCanSignIn() {
        for (DemoDataSeeder.DemoUser user : DemoDataSeeder.DEMO_USERS) {
            String[] tokens = login(user.email(), DemoDataSeeder.DEMO_PASSWORD);
            JsonNode me = data(get("/api/v1/auth/me", tokens[0]));
            assertThat(me.path("roles").toString()).contains(user.roleCode());
            assertThat(me.path("demoOrganization").asBoolean()).isTrue();
        }
        String lead = login("demo.lead@workpulse.demo", DemoDataSeeder.DEMO_PASSWORD)[0];
        JsonNode overview = data(get("/api/v1/dashboard/overview", lead));
        assertThat(overview.path("scopeLevel").asText()).isEqualTo("TEAM");
        assertThat(overview.path("headcount").path("total").asLong()).isLessThan(12);
    }
}
