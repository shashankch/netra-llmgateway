package com.netra.gateway.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.model.entity.RequestLog;
import com.netra.gateway.service.LogStreamBroadcaster;
import com.netra.gateway.service.TenantAuthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

import java.nio.charset.StandardCharsets;
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
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory connectionFactory,
            TenantAuthService tenantAuthService,
            LogStreamBroadcaster logStreamBroadcaster,
            ObjectMapper objectMapper
    ) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);

        container.addMessageListener((message, pattern) -> {
            try {
                String virtualKey = new String(message.getBody(), StandardCharsets.UTF_8);
                tenantAuthService.invalidateLocal(virtualKey);
            } catch (Exception e) {
                log.error("Failed to process tenant invalidation message: {}", e.getMessage(), e);
            }
        }, new ChannelTopic("netra:tenant:invalidation"));

        container.addMessageListener((message, pattern) -> {
            try {
                String json = new String(message.getBody(), StandardCharsets.UTF_8);
                RequestLog logEntry = objectMapper.readValue(json, RequestLog.class);
                logStreamBroadcaster.broadcastLocally(logEntry);
            } catch (Exception e) {
                log.error("Failed to deserialize or broadcast log entry from Redis pub/sub: {}", e.getMessage(), e);
            }
        }, new ChannelTopic("netra:logs:broadcast"));

        return container;
    }
}
