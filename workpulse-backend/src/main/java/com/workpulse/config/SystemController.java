package com.workpulse.config;

import com.workpulse.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.boot.info.BuildProperties;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.sql.Connection;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/system")
@RequiredArgsConstructor
@Tag(name = "System")
public class SystemController {

    private final DataSource dataSource;
    private final StringRedisTemplate redisTemplate;
    private final ConnectionFactory rabbitConnectionFactory;
    private final Optional<BuildProperties> buildProperties;

    @GetMapping("/health")
    @PreAuthorize("hasAuthority('SYSTEM_VIEW')")
    public ApiResponse<Map<String, Object>> health() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("database", check(() -> { try (Connection c = dataSource.getConnection()) { return c.isValid(2); } }));
        result.put("redis", check(() -> "PONG".equalsIgnoreCase(String.valueOf(redisTemplate.getConnectionFactory().getConnection().ping()))));
        result.put("rabbitmq", check(() -> { try (var c = rabbitConnectionFactory.createConnection()) { return c.isOpen(); } }));
        result.put("uptimeSeconds", ManagementFactory.getRuntimeMXBean().getUptime() / 1000);
        result.put("version", buildProperties.map(BuildProperties::getVersion).orElse("dev"));
        result.put("serverTime", Instant.now());
        return ApiResponse.ok(result);
    }

    private interface Probe {
        boolean run() throws Exception;
    }

    private static String check(Probe probe) {
        try {
            return probe.run() ? "UP" : "DOWN";
        } catch (Exception ex) {
            return "DOWN";
        }
    }
}
