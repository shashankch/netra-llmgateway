package com.netra.gateway.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.netra.gateway.model.entity.RequestLog;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
public class LogStreamBroadcaster {

    private static final int MAX_PENDING_PER_SUBSCRIBER = 100;

    private final List<SubscriberSession> sessions = new CopyOnWriteArrayList<>();
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Autowired
    public LogStreamBroadcaster(
            @Autowired(required = false) StringRedisTemplate redisTemplate,
            @Autowired(required = false) ObjectMapper objectMapper
    ) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public LogStreamBroadcaster() {
        this(null, null);
    }

    public SseEmitter registerEmitter() {
        // 5-minute timeout for live stream
        SseEmitter emitter = new SseEmitter(300_000L);
        SubscriberSession session = new SubscriberSession(emitter, () -> sessions.removeIf(s -> s.getEmitter() == emitter));
        sessions.add(session);

        emitter.onCompletion(session::close);
        emitter.onTimeout(session::close);
        emitter.onError(e -> session.close());

        try {
            emitter.send(SseEmitter.event().name("connected").data("connected to NETRA live log stream"));
        } catch (IOException e) {
            session.close();
        }

        return emitter;
    }

    /**
     * Broadcasts log entry to all subscribers across cluster nodes via Redis Pub/Sub.
     */
    public void broadcast(RequestLog logEntry) {
        if (logEntry == null) {
            return;
        }

        if (redisTemplate != null && objectMapper != null) {
            try {
                String json = objectMapper.writeValueAsString(logEntry);
                Long subscribers = redisTemplate.convertAndSend("netra:logs:broadcast", json);
                if (subscribers != null && subscribers > 0) {
                    return;
                }
            } catch (Exception e) {
                log.debug("Redis live log broadcast failed; broadcasting locally: {}", e.getMessage());
            }
        }

        broadcastLocally(logEntry);
    }

    /**
     * Sends log entry to SSE subscriber sessions attached to this JVM process.
     * Enqueues into per-subscriber bounded mailboxes. Sluggish subscribers exceeding
     * capacity are disconnected to prevent backpressure from holding other subscribers.
     */
    public void broadcastLocally(RequestLog logEntry) {
        if (sessions.isEmpty() || logEntry == null) {
            return;
        }
        for (SubscriberSession session : sessions) {
            session.enqueue(logEntry);
        }
    }

    /**
     * Per-subscriber bounded mailbox session.
     */
    private static class SubscriberSession {
        private final SseEmitter emitter;
        private final Runnable onCleanup;
        private final BlockingQueue<RequestLog> mailbox = new ArrayBlockingQueue<>(MAX_PENDING_PER_SUBSCRIBER);
        private final AtomicBoolean isDraining = new AtomicBoolean(false);
        private volatile boolean closed = false;

        SubscriberSession(SseEmitter emitter, Runnable onCleanup) {
            this.emitter = emitter;
            this.onCleanup = onCleanup;
        }

        SseEmitter getEmitter() {
            return emitter;
        }

        void enqueue(RequestLog logEntry) {
            if (closed) return;
            // Bounded offer: if slow subscriber cannot keep up with real-time stream, disconnect it
            boolean accepted = mailbox.offer(logEntry);
            if (!accepted) {
                log.warn("Disconnecting slow SSE subscriber: pending mailbox capacity of {} exceeded", MAX_PENDING_PER_SUBSCRIBER);
                close();
                return;
            }
            drain();
        }

        private void drain() {
            if (isDraining.compareAndSet(false, true)) {
                Thread.ofVirtual().name("sse-session-drain-", 0).start(() -> {
                    try {
                        RequestLog item;
                        while ((item = mailbox.poll()) != null) {
                            if (closed) break;
                            try {
                                emitter.send(SseEmitter.event().name("log").data(item));
                            } catch (Exception ex) {
                                close();
                                break;
                            }
                        }
                    } finally {
                        isDraining.set(false);
                        if (!mailbox.isEmpty() && !closed) {
                            drain();
                        }
                    }
                });
            }
        }

        void close() {
            if (!closed) {
                closed = true;
                mailbox.clear();
                onCleanup.run();
                try {
                    emitter.complete();
                } catch (Exception ignored) {}
            }
        }
    }
}
