package com.workpulse.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.workpulse.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RbacIsolationIT extends AbstractIntegrationTest {

    @Test
    void organizationsCannotSeeEachOthersData() {
        OrgFixture a = createOrganization("Acme Corp", "acme-iso", "admin@acme-iso.test", "AcmePassword!123");
        OrgFixture b = createOrganization("Globex", "globex-iso", "admin@globex-iso.test", "GlobexPassword!123");

        String deptA = data(post("/api/v1/departments", Map.of("name", "Engineering"), a.adminToken())).path("id").asText();
        String employeeA = createEmployee(a.adminToken(), "A-001", "Ada", "Lovelace", "ada@acme-iso.test", deptA, null);

        assertThat(get("/api/v1/employees/" + employeeA, a.adminToken()).getStatusCode().value()).isEqualTo(200);
        ResponseEntity<JsonNode> crossTenant = get("/api/v1/employees/" + employeeA, b.adminToken());
        assertThat(crossTenant.getStatusCode().value()).as("other tenant must get 404, not 403").isEqualTo(404);
        assertThat(get("/api/v1/departments/" + deptA, b.adminToken()).getStatusCode().value()).isEqualTo(404);
        assertThat(data(get("/api/v1/employees", b.adminToken())).size()).isZero();
    }

    @Test
    void employeeRoleIsLimitedToSelfService() {
        OrgFixture org = createOrganization("Initech", "initech-rbac", "admin@initech-rbac.test", "InitechPassword!123");
        String dept = data(post("/api/v1/departments", Map.of("name", "Operations"), org.adminToken())).path("id").asText();
        String employee = createEmployee(org.adminToken(), "I-001", "Peter", "Gibbons", "peter@initech-rbac.test", dept, null);
        String token = inviteAndLogin(org.adminToken(), "peter@initech-rbac.test", "PeterPassword!123", employee,
                List.of(Map.of("roleCode", "EMPLOYEE")));

        ResponseEntity<JsonNode> directory = get("/api/v1/employees", token);
        assertThat(directory.getStatusCode().value()).isEqualTo(403);
        assertThat(errorCode(directory)).isEqualTo("FORBIDDEN");

        JsonNode me = data(get("/api/v1/employees/me", token));
        assertThat(me.path("id").asText()).isEqualTo(employee);
        assertThat(get("/api/v1/dashboard/me", token).getStatusCode().value()).isEqualTo(200);
        assertThat(get("/api/v1/policies/effective", token).getStatusCode().value()).isEqualTo(200);

        ResponseEntity<JsonNode> create = post("/api/v1/employees", Map.of("employeeCode", "X", "firstName", "x", "lastName", "y",
                "workEmail", "x@initech-rbac.test"), token);
        assertThat(create.getStatusCode().value()).isEqualTo(403);
    }

    @Test
    void teamLeadOnlySeesOwnTeam() {
        OrgFixture org = createOrganization("Umbrella", "umbrella-rbac", "admin@umbrella-rbac.test", "UmbrellaPassword!123");
        String dept = data(post("/api/v1/departments", Map.of("name", "Research"), org.adminToken())).path("id").asText();
        String team1 = data(post("/api/v1/teams", Map.of("name", "Alpha", "departmentId", dept), org.adminToken())).path("id").asText();
        String team2 = data(post("/api/v1/teams", Map.of("name", "Beta", "departmentId", dept), org.adminToken())).path("id").asText();
        String lead = createEmployee(org.adminToken(), "U-001", "Alice", "Lead", "alice@umbrella-rbac.test", dept, team1);
        String member = createEmployee(org.adminToken(), "U-002", "Bob", "Member", "bob@umbrella-rbac.test", dept, team1);
        String outsider = createEmployee(org.adminToken(), "U-003", "Carol", "Other", "carol@umbrella-rbac.test", dept, team2);

        String leadToken = inviteAndLogin(org.adminToken(), "alice@umbrella-rbac.test", "AlicePassword!123", lead,
                List.of(Map.of("roleCode", "TEAM_LEAD", "teamId", team1)));

        JsonNode me = data(get("/api/v1/auth/me", leadToken));
        assertThat(me.path("scope").path("level").asText()).isEqualTo("TEAM");

        JsonNode visible = data(get("/api/v1/employees?size=50", leadToken));
        List<String> ids = visible.findValuesAsText("id");
        assertThat(ids).contains(lead, member).doesNotContain(outsider);

        assertThat(get("/api/v1/employees/" + member, leadToken).getStatusCode().value()).isEqualTo(200);
        assertThat(get("/api/v1/employees/" + outsider, leadToken).getStatusCode().value()).isEqualTo(404);
        assertThat(get("/api/v1/activity/timeline?employeeId=" + outsider, leadToken).getStatusCode().value()).isEqualTo(404);

        JsonNode overview = data(get("/api/v1/dashboard/overview", leadToken));
        assertThat(overview.path("headcount").path("total").asLong()).isEqualTo(2);
        assertThat(overview.path("scopeLevel").asText()).isEqualTo("TEAM");

        // the admin's reads of employee data are recorded in the data-access log
        JsonNode accessLog = data(get("/api/v1/data-access-logs?employeeId=" + member, org.adminToken()));
        assertThat(accessLog.toString()).contains("EMPLOYEE");
    }

    @Test
    void auditTrailRecordsAdministrativeChanges() {
        OrgFixture org = createOrganization("Hooli", "hooli-audit", "admin@hooli-audit.test", "HooliPassword!123");
        String dept = data(post("/api/v1/departments", Map.of("name", "Platform"), org.adminToken())).path("id").asText();
        JsonNode logs = data(get("/api/v1/audit-logs?entityType=DEPARTMENT", org.adminToken()));
        assertThat(logs.toString()).contains("DEPARTMENT_CREATED").contains(dept);
    }
}
