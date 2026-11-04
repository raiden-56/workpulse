package com.workpulse.agent;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AgentServiceTest {

    @Test
    void comparesSemanticVersions() {
        assertThat(AgentService.compareVersions("1.0.0", "1.0.0")).isZero();
        assertThat(AgentService.compareVersions("0.9.4", "1.0.0")).isNegative();
        assertThat(AgentService.compareVersions("1.0.10", "1.0.9")).isPositive();
        assertThat(AgentService.compareVersions("1.2", "1.2.0")).isZero();
        assertThat(AgentService.compareVersions("1.0.0-beta", "1.0.0")).isZero();
    }
}
