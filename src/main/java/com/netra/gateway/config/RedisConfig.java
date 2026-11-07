package com.netra.gateway.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

import java.util.List;

@Slf4j
@Configuration
public class RedisConfig {

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }

    @Bean
    @SuppressWarnings("unchecked")
    public RedisScript<List> admissionScript() {
        return (RedisScript<List>) (RedisScript<?>) RedisScript.of(
                new ClassPathResource("scripts/admission.lua"),
                List.class
        );
    }

    @Bean
    public org.springframework.data.redis.listener.RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory connectionFactory,
            com.netra.gateway.service.TenantAuthService tenantAuthService,
            com.netra.gateway.service.LogStreamBroadcaster logStreamBroadcaster,
            com.fasterxml.jackson.databind.ObjectMapper objectMapper
    ) {
        org.springframework.data.redis.listener.RedisMessageListenerContainer container =
                new org.springframework.data.redis.listener.RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);

        container.addMessageListener((message, pattern) -> {
            try {
                String virtualKey = new String(message.getBody(), java.nio.charset.StandardCharsets.UTF_8);
                tenantAuthService.invalidateLocal(virtualKey);
            } catch (Exception e) {
                log.error("Failed to process tenant invalidation message: {}", e.getMessage(), e);
            }
        }, new org.springframework.data.redis.listener.ChannelTopic("netra:tenant:invalidation"));

        container.addMessageListener((message, pattern) -> {
            try {
                String json = new String(message.getBody(), java.nio.charset.StandardCharsets.UTF_8);
                com.netra.gateway.model.entity.RequestLog logEntry = objectMapper.readValue(json, com.netra.gateway.model.entity.RequestLog.class);
                logStreamBroadcaster.broadcastLocally(logEntry);
            } catch (Exception e) {
                log.error("Failed to deserialize or broadcast log entry from Redis pub/sub: {}", e.getMessage(), e);
            }
        }, new org.springframework.data.redis.listener.ChannelTopic("netra:logs:broadcast"));

        return container;
    }
}
