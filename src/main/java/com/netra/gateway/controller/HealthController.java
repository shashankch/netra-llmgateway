package com.netra.gateway.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.info.BuildProperties;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.Map;

@RestController
public class HealthController {

    @Autowired(required = false)
    private DataSource dataSource;

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    @Autowired(required = false)
    private BuildProperties buildProperties;

    @Autowired(required = false)
    private com.netra.gateway.service.CanonicalDataSeeder canonicalDataSeeder;

    private String getVersion() {
        return buildProperties != null ? buildProperties.getVersion() : "0.7.3";
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "service", "netra-gateway",
                "version", getVersion()
        ));
    }

    @GetMapping("/health/live")
    public ResponseEntity<Map<String, Object>> live() {
        return health();
    }

    @GetMapping("/health/ready")
    public ResponseEntity<Map<String, Object>> ready() {
        boolean dbOk = checkDatabase();
        boolean redisOk = checkRedis();
        boolean seederOk = canonicalDataSeeder == null || canonicalDataSeeder.isSeedingComplete();
        boolean isReady = dbOk && redisOk && seederOk;

        return ResponseEntity.status(isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "status", isReady ? "UP" : "DEGRADED",
                "database", dbOk ? "UP" : "DOWN",
                "redis", redisOk ? "UP" : "DOWN",
                "seeder", seederOk ? "READY" : "SEEDING",
                "version", getVersion()
        ));
    }

    private boolean checkDatabase() {
        if (dataSource == null) return true;
        try (Connection conn = dataSource.getConnection()) {
            return conn.isValid(1);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean checkRedis() {
        if (redisTemplate == null) return true;
        try {
            RedisConnectionFactory factory = redisTemplate.getConnectionFactory();
            if (factory == null) return false;
            try (RedisConnection conn = factory.getConnection()) {
                return "PONG".equalsIgnoreCase(conn.ping());
            }
        } catch (Exception e) {
            return false;
        }
    }
}
