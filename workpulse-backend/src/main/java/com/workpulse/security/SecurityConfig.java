package com.workpulse.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.workpulse.config.WorkPulseProperties;
import com.workpulse.devices.DeviceTokenRepository;
import com.workpulse.security.device.DeviceTokenAuthenticationFilter;
import com.workpulse.security.jwt.JwtAuthenticationFilter;
import com.workpulse.security.jwt.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtService jwtService;
    private final DeviceTokenRepository deviceTokenRepository;
    private final StringRedisTemplate redisTemplate;
    private final WorkPulseProperties properties;
    private final ObjectMapper objectMapper;
    private final CorsConfigurationSource corsConfigurationSource;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        ApiAuthenticationEntryPoint entryPoint = new ApiAuthenticationEntryPoint(objectMapper);
        ApiAccessDeniedHandler deniedHandler = new ApiAccessDeniedHandler(objectMapper);

        TraceIdFilter traceIdFilter = new TraceIdFilter();
        RateLimitFilter rateLimitFilter = new RateLimitFilter(redisTemplate, properties, objectMapper);
        JwtAuthenticationFilter jwtFilter = new JwtAuthenticationFilter(jwtService);
        DeviceTokenAuthenticationFilter deviceFilter = new DeviceTokenAuthenticationFilter(deviceTokenRepository);
        GuestReadOnlyFilter guestFilter = new GuestReadOnlyFilter(objectMapper);

        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(h -> h.frameOptions(f -> f.deny()))
                .exceptionHandling(eh -> eh.authenticationEntryPoint(entryPoint).accessDeniedHandler(deniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers("/ws/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/login", "/api/v1/auth/refresh",
                                "/api/v1/auth/forgot-password", "/api/v1/auth/reset-password",
                                "/api/v1/users/activate", "/api/v1/guest/sessions").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/guest/config").permitAll()
                        .requestMatchers("/api/v1/agent/heartbeat", "/api/v1/agent/policy", "/api/v1/activity/batch")
                                .hasAuthority(DevicePrincipal.AUTHORITY)
                        .requestMatchers("/actuator/**").hasAuthority(Permissions.SYSTEM_VIEW)
                        .anyRequest().authenticated())
                .addFilterBefore(traceIdFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(rateLimitFilter, TraceIdFilter.class)
                .addFilterAfter(jwtFilter, RateLimitFilter.class)
                .addFilterAfter(deviceFilter, JwtAuthenticationFilter.class)
                .addFilterAfter(guestFilter, DeviceTokenAuthenticationFilter.class);

        return http.build();
    }
}
