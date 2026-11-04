package com.workpulse.common.messaging;

import com.workpulse.config.RabbitConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

/**
 * Best-effort publisher onto the {@code workpulse.events} topic exchange.
 * Publishing failures are logged and never break the calling request: the database is the
 * source of truth, consumers can rebuild derived data from it.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publish(String routingKey, Object payload) {
        try {
            rabbitTemplate.convertAndSend(RabbitConfig.EVENTS_EXCHANGE, routingKey, payload);
        } catch (Exception ex) {
            log.warn("Event publish failed for routing key {}: {}", routingKey, ex.getMessage());
        }
    }
}
