package com.workpulse.websocket;

import com.workpulse.config.WorkPulseProperties;
import com.workpulse.security.UserPrincipal;
import com.workpulse.security.jwt.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.List;

/**
 * STOMP over WebSocket for live workforce updates. The JWT travels in the CONNECT frame's
 * {@code Authorization} header; subscriptions are restricted to the principal's organisation.
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
@Slf4j
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtService jwtService;
    private final WorkPulseProperties properties;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        List<String> origins = properties.cors().allowedOrigins();
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(origins == null || origins.isEmpty() ? new String[]{"http://localhost:*"} : origins.toArray(new String[0]))
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null) {
                    return message;
                }
                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String header = accessor.getFirstNativeHeader("Authorization");
                    if (header == null || !header.startsWith("Bearer ")) {
                        throw new IllegalArgumentException("Missing bearer token");
                    }
                    UserPrincipal principal = jwtService.parse(header.substring(7).trim());
                    accessor.setUser(new UsernamePasswordAuthenticationToken(principal, null, principal.authorities()));
                } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                    if (!(accessor.getUser() instanceof UsernamePasswordAuthenticationToken auth)
                            || !(auth.getPrincipal() instanceof UserPrincipal principal)) {
                        throw new IllegalArgumentException("Not authenticated");
                    }
                    String destination = accessor.getDestination();
                    if (destination != null && destination.startsWith("/topic/org.")) {
                        String orgId = destination.substring("/topic/org.".length()).split("\\.")[0];
                        boolean allowed = principal.isSuperAdmin()
                                || (principal.getOrganizationId() != null && principal.getOrganizationId().toString().equals(orgId));
                        boolean permitted = destination.endsWith(".live") ? principal.hasPermission("LIVE_MONITORING_VIEW")
                                : !destination.endsWith(".devices") || principal.hasPermission("DEVICE_VIEW");
                        if (!allowed || !permitted) {
                            throw new IllegalArgumentException("Subscription not permitted");
                        }
                    }
                }
                return message;
            }
        });
    }
}
