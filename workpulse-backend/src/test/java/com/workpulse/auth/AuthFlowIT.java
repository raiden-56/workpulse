package com.workpulse.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.workpulse.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AuthFlowIT extends AbstractIntegrationTest {

    @Test
    void loginReturnsTokensAndPrincipal() {
        String[] tokens = login(ROOT_EMAIL, ROOT_PASSWORD);
        assertThat(tokens[0]).isNotBlank();
        assertThat(tokens[1]).isNotBlank();

        JsonNode me = data(get("/api/v1/auth/me", tokens[0]));
        assertThat(me.path("email").asText()).isEqualTo(ROOT_EMAIL);
        assertThat(me.path("roles").toString()).contains("SUPER_ADMIN");
        assertThat(me.path("permissions").toString()).contains("ORGANIZATION_CREATE");
        assertThat(me.path("scope").path("level").asText()).isEqualTo("GLOBAL");
    }

    @Test
    void invalidCredentialsAreRejectedAndAudited() {
        ResponseEntity<JsonNode> response = post("/api/v1/auth/login", Map.of("email", ROOT_EMAIL, "password", "wrong-password"), null);
        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(errorCode(response)).isEqualTo("INVALID_CREDENTIALS");

        String token = rootToken();
        JsonNode history = data(get("/api/v1/auth/login-history", token));
        assertThat(history.toString()).contains("INVALID_CREDENTIALS");
    }

    @Test
    void refreshRotatesTokensAndDetectsReuse() {
        String[] first = login(ROOT_EMAIL, ROOT_PASSWORD);
        ResponseEntity<JsonNode> refreshed = post("/api/v1/auth/refresh", Map.of("refreshToken", first[1]), null);
        assertThat(refreshed.getStatusCode().value()).isEqualTo(200);
        JsonNode second = data(refreshed);
        assertThat(second.path("refreshToken").asText()).isNotEqualTo(first[1]);
        assertThat(get("/api/v1/auth/me", second.path("accessToken").asText()).getStatusCode().value()).isEqualTo(200);

        // Presenting the rotated token again is treated as theft: the whole family is revoked.
        ResponseEntity<JsonNode> reuse = post("/api/v1/auth/refresh", Map.of("refreshToken", first[1]), null);
        assertThat(reuse.getStatusCode().value()).isEqualTo(401);
        assertThat(errorCode(reuse)).isEqualTo("TOKEN_REUSED");
        ResponseEntity<JsonNode> familyRevoked = post("/api/v1/auth/refresh", Map.of("refreshToken", second.path("refreshToken").asText()), null);
        assertThat(familyRevoked.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void unauthenticatedAndMalformedTokensGet401() {
        assertThat(get("/api/v1/employees", null).getStatusCode().value()).isEqualTo(401);
        ResponseEntity<JsonNode> bad = get("/api/v1/employees", "not-a-jwt");
        assertThat(bad.getStatusCode().value()).isEqualTo(401);
        assertThat(errorCode(bad)).isEqualTo("UNAUTHORIZED");
    }

    @Test
    void superAdminNeedsOrganizationHeaderForTenantData() {
        String token = rootToken();
        ResponseEntity<JsonNode> withoutOrg = get("/api/v1/employees", token);
        assertThat(withoutOrg.getStatusCode().value()).isEqualTo(400);

        JsonNode orgs = data(get("/api/v1/organizations", token));
        String orgId = orgs.get(0).path("id").asText();
        ResponseEntity<JsonNode> withOrg = get("/api/v1/employees", token, Map.of("X-Organization-Id", orgId));
        assertThat(withOrg.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void logoutRevokesRefreshToken() {
        String[] tokens = login(ROOT_EMAIL, ROOT_PASSWORD);
        assertThat(post("/api/v1/auth/logout", Map.of("refreshToken", tokens[1]), tokens[0]).getStatusCode().value()).isEqualTo(200);
        ResponseEntity<JsonNode> refresh = post("/api/v1/auth/refresh", Map.of("refreshToken", tokens[1]), null);
        assertThat(refresh.getStatusCode().value()).isEqualTo(401);
    }
}
