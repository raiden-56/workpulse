package com.workpulse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.RabbitMQContainer;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Boots the full application against disposable PostgreSQL, Redis and RabbitMQ containers.
 * Containers are started once per JVM and shared by every integration test class.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "workpulse.demo.enabled=false",
        "workpulse.rate-limit.enabled=false",
        "workpulse.agent.auto-approve-devices=true",
        "workpulse.bootstrap.admin-email=root@test.local",
        "workpulse.bootstrap.admin-password=RootPassword!123",
        "workpulse.bootstrap.organization-name=Test Platform"
})
public abstract class AbstractIntegrationTest {

    public static final String ROOT_EMAIL = "root@test.local";
    public static final String ROOT_PASSWORD = "RootPassword!123";

    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @ServiceConnection
    static final RabbitMQContainer RABBIT = new RabbitMQContainer("rabbitmq:3.13-alpine");

    @ServiceConnection(name = "redis")
    static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    static {
        POSTGRES.start();
        RABBIT.start();
        REDIS.start();
    }

    @Autowired
    protected TestRestTemplate rest;

    @Autowired
    protected ObjectMapper objectMapper;

    protected ResponseEntity<JsonNode> call(HttpMethod method, String path, Object body, String bearer, Map<String, String> extraHeaders) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(java.util.List.of(MediaType.APPLICATION_JSON));
        if (bearer != null) {
            headers.setBearerAuth(bearer);
        }
        if (extraHeaders != null) {
            extraHeaders.forEach(headers::set);
        }
        return rest.exchange(path, method, new HttpEntity<>(body, headers), JsonNode.class);
    }

    protected ResponseEntity<JsonNode> get(String path, String bearer) {
        return call(HttpMethod.GET, path, null, bearer, null);
    }

    protected ResponseEntity<JsonNode> get(String path, String bearer, Map<String, String> headers) {
        return call(HttpMethod.GET, path, null, bearer, headers);
    }

    protected ResponseEntity<JsonNode> post(String path, Object body, String bearer) {
        return call(HttpMethod.POST, path, body, bearer, null);
    }

    protected ResponseEntity<JsonNode> put(String path, Object body, String bearer) {
        return call(HttpMethod.PUT, path, body, bearer, null);
    }

    protected ResponseEntity<JsonNode> delete(String path, String bearer) {
        return call(HttpMethod.DELETE, path, null, bearer, null);
    }

    protected JsonNode data(ResponseEntity<JsonNode> response) {
        assertThat(response.getBody()).as("response body").isNotNull();
        assertThat(response.getBody().path("success").asBoolean()).as("success flag for %s", response.getBody()).isTrue();
        return response.getBody().path("data");
    }

    protected String errorCode(ResponseEntity<JsonNode> response) {
        assertThat(response.getBody()).isNotNull();
        return response.getBody().path("error").path("code").asText();
    }

    /** Returns [accessToken, refreshToken]. */
    protected String[] login(String email, String password) {
        ResponseEntity<JsonNode> response = post("/api/v1/auth/login", Map.of("email", email, "password", password), null);
        assertThat(response.getStatusCode().value()).as("login %s -> %s", email, response.getBody()).isEqualTo(200);
        JsonNode d = data(response);
        return new String[]{d.path("accessToken").asText(), d.path("refreshToken").asText()};
    }

    protected String rootToken() {
        return login(ROOT_EMAIL, ROOT_PASSWORD)[0];
    }

    /** Creates an organisation as super admin, activates its admin, and returns the admin's access token. */
    protected OrgFixture createOrganization(String name, String slug, String adminEmail, String adminPassword) {
        String root = rootToken();
        ResponseEntity<JsonNode> created = post("/api/v1/organizations", Map.of(
                "name", name, "slug", slug, "timezone", "Asia/Kolkata",
                "adminEmail", adminEmail, "adminDisplayName", name + " Admin"), root);
        assertThat(created.getStatusCode().value()).as("create org %s", created.getBody()).isEqualTo(201);
        JsonNode d = data(created);
        String orgId = d.path("organization").path("id").asText();
        String activation = d.path("adminActivationToken").asText();
        ResponseEntity<JsonNode> activated = post("/api/v1/users/activate", Map.of("token", activation, "password", adminPassword), null);
        assertThat(activated.getStatusCode().value()).as("activate %s", activated.getBody()).isEqualTo(200);
        return new OrgFixture(orgId, login(adminEmail, adminPassword)[0]);
    }

    /** Invites a user with the given roles, activates it and returns an access token. */
    protected String inviteAndLogin(String adminToken, String email, String password, String employeeId, java.util.List<Map<String, Object>> roles) {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("email", email);
        body.put("displayName", email);
        body.put("employeeId", employeeId);
        body.put("roles", roles);
        ResponseEntity<JsonNode> invited = post("/api/v1/users/invite", body, adminToken);
        assertThat(invited.getStatusCode().value()).as("invite %s", invited.getBody()).isEqualTo(201);
        String activation = data(invited).path("activationToken").asText();
        ResponseEntity<JsonNode> activated = post("/api/v1/users/activate", Map.of("token", activation, "password", password), null);
        assertThat(activated.getStatusCode().value()).isEqualTo(200);
        return login(email, password)[0];
    }

    protected String createEmployee(String adminToken, String code, String first, String last, String email, String departmentId, String teamId) {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("employeeCode", code);
        body.put("firstName", first);
        body.put("lastName", last);
        body.put("workEmail", email);
        body.put("designation", "Engineer");
        body.put("departmentId", departmentId);
        body.put("teamId", teamId);
        body.put("roleProfile", "DEVELOPER");
        ResponseEntity<JsonNode> response = post("/api/v1/employees", body, adminToken);
        assertThat(response.getStatusCode().value()).as("create employee %s", response.getBody()).isEqualTo(201);
        return data(response).path("id").asText();
    }

    public record OrgFixture(String organizationId, String adminToken) {}
}
