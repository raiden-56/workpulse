package com.workpulse.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarable;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Messaging topology (see docs/api/EVENT_CONTRACTS.md §4). The application declares it on connection,
 * so the broker needs no pre-loaded definitions.
 */
@Configuration
public class RabbitConfig {

    public static final String EVENTS_EXCHANGE = "workpulse.events";
    public static final String DLX_EXCHANGE = "workpulse.dlx";
    public static final String DLQ = "workpulse.dlq";

    public static final String QUEUE_ACTIVITY_DERIVATION = "workpulse.activity.derivation";
    public static final String QUEUE_ANOMALY_RULES = "workpulse.anomaly.rules";
    public static final String QUEUE_NOTIFICATIONS = "workpulse.notifications";
    public static final String QUEUE_AUDIT = "workpulse.audit";

    /** queue → routing keys bound from the events exchange */
    private static final Map<String, List<String>> BINDINGS = Map.of(
            QUEUE_ACTIVITY_DERIVATION, List.of("activity.ingested"),
            QUEUE_ANOMALY_RULES, List.of("anomaly.candidate"),
            QUEUE_NOTIFICATIONS, List.of("anomaly.detected", "device.health", "notification.created"),
            QUEUE_AUDIT, List.of("audit.record"));

    @Bean
    public Declarables workPulseTopology() {
        TopicExchange events = new TopicExchange(EVENTS_EXCHANGE, true, false);
        TopicExchange dlx = new TopicExchange(DLX_EXCHANGE, true, false);
        Queue dlq = QueueBuilder.durable(DLQ).build();
        List<Declarable> declarables = new ArrayList<>(List.of(events, dlx, dlq, BindingBuilder.bind(dlq).to(dlx).with("#")));
        BINDINGS.forEach((queueName, keys) -> {
            Queue queue = QueueBuilder.durable(queueName).deadLetterExchange(DLX_EXCHANGE).build();
            declarables.add(queue);
            for (String key : keys) {
                Binding binding = BindingBuilder.bind(queue).to(events).with(key);
                declarables.add(binding);
            }
        });
        return new Declarables(declarables);
    }

    @Bean
    public Jackson2JsonMessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, Jackson2JsonMessageConverter converter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(converter);
        template.setExchange(EVENTS_EXCHANGE);
        return template;
    }
}
