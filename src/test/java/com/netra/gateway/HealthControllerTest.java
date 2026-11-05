package com.netra.gateway;

import com.netra.gateway.controller.HealthController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import javax.sql.DataSource;
import java.sql.Connection;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(HealthController.class)
class HealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DataSource dataSource;

    @MockitoBean
    private StringRedisTemplate redisTemplate;

    @MockitoBean
    private com.netra.gateway.service.CanonicalDataSeeder canonicalDataSeeder;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        if (canonicalDataSeeder != null) {
            when(canonicalDataSeeder.isSeedingComplete()).thenReturn(true);
        }
    }

    @Test
    @DisplayName("GET /health returns 200 OK with service netra-gateway and version 0.7.0")
    void testBasicHealth() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.service").value("netra-gateway"))
                .andExpect(jsonPath("$.version").value("0.7.0"));
    }

    @Test
    @DisplayName("GET /health/live returns 200 OK liveness probe")
    void testLivenessProbe() throws Exception {
        mockMvc.perform(get("/health/live"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.version").value("0.7.0"));
    }

    @Test
    @DisplayName("GET /health/ready returns 200 OK when both DB and Redis are UP")
    void testReadinessProbeHealthy() throws Exception {
        Connection mockConnection = mock(Connection.class);
        when(mockConnection.isValid(anyInt())).thenReturn(true);
        when(dataSource.getConnection()).thenReturn(mockConnection);

        RedisConnectionFactory factory = mock(RedisConnectionFactory.class);
        RedisConnection redisConn = mock(RedisConnection.class);
        when(redisTemplate.getConnectionFactory()).thenReturn(factory);
        when(factory.getConnection()).thenReturn(redisConn);
        when(redisConn.ping()).thenReturn("PONG");

        mockMvc.perform(get("/health/ready"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.database").value("UP"))
                .andExpect(jsonPath("$.redis").value("UP"))
                .andExpect(jsonPath("$.version").value("0.7.0"));
    }

    @Test
    @DisplayName("GET /health/ready returns 503 SERVICE_UNAVAILABLE when database is DOWN")
    void testReadinessProbeDatabaseDown() throws Exception {
        when(dataSource.getConnection()).thenThrow(new RuntimeException("DB Connection refused"));

        RedisConnectionFactory factory = mock(RedisConnectionFactory.class);
        RedisConnection redisConn = mock(RedisConnection.class);
        when(redisTemplate.getConnectionFactory()).thenReturn(factory);
        when(factory.getConnection()).thenReturn(redisConn);
        when(redisConn.ping()).thenReturn("PONG");

        mockMvc.perform(get("/health/ready"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("DEGRADED"))
                .andExpect(jsonPath("$.database").value("DOWN"))
                .andExpect(jsonPath("$.redis").value("UP"));
    }

    @Test
    @DisplayName("GET /health/ready returns 503 SERVICE_UNAVAILABLE when Redis is DOWN")
    void testReadinessProbeRedisDown() throws Exception {
        Connection mockConnection = mock(Connection.class);
        when(mockConnection.isValid(anyInt())).thenReturn(true);
        when(dataSource.getConnection()).thenReturn(mockConnection);

        when(redisTemplate.getConnectionFactory()).thenThrow(new RuntimeException("Redis cluster unreachable"));

        mockMvc.perform(get("/health/ready"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("DEGRADED"))
                .andExpect(jsonPath("$.database").value("UP"))
                .andExpect(jsonPath("$.redis").value("DOWN"));
    }

    @Test
    @DisplayName("GET /health/ready returns 503 SERVICE_UNAVAILABLE when canonical data seeder is still SEEDING")
    void testReadinessProbeSeedingInProgress() throws Exception {
        Connection mockConnection = mock(Connection.class);
        when(mockConnection.isValid(anyInt())).thenReturn(true);
        when(dataSource.getConnection()).thenReturn(mockConnection);

        RedisConnectionFactory factory = mock(RedisConnectionFactory.class);
        RedisConnection redisConn = mock(RedisConnection.class);
        when(redisTemplate.getConnectionFactory()).thenReturn(factory);
        when(factory.getConnection()).thenReturn(redisConn);
        when(redisConn.ping()).thenReturn("PONG");

        when(canonicalDataSeeder.isSeedingComplete()).thenReturn(false);

        mockMvc.perform(get("/health/ready"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("DEGRADED"))
                .andExpect(jsonPath("$.database").value("UP"))
                .andExpect(jsonPath("$.redis").value("UP"))
                .andExpect(jsonPath("$.seeder").value("SEEDING"));
    }
}
