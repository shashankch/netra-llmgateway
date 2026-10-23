# NETRA LLM Gateway - Production Containerfile
# Multi-stage build on Eclipse Temurin Java 25 (LTS)

# Build stage
FROM eclipse-temurin:25-jdk AS builder
WORKDIR /workspace

# Copy Gradle wrappers and build definitions
COPY gradlew .
COPY gradle gradle
COPY build.gradle.kts .
COPY settings.gradle.kts .

# Cache dependencies
RUN ./gradlew dependencies --no-daemon || true

# Copy source code and canonical data
COPY src src
COPY data data

# Build bootable executable JAR without tests
RUN ./gradlew bootJar --no-daemon -x test

# Runtime stage
FROM eclipse-temurin:25-jre
WORKDIR /app

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Create non-root execution user
RUN groupadd -r netra && useradd -r -g netra -u 10001 netra

# Copy artifacts from builder
COPY --from=builder /workspace/build/libs/netra-gateway-0.1.0.jar app.jar
COPY --from=builder /workspace/data data

# Set ownership
RUN chown -R netra:netra /app

USER netra

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["java", "-XX:+UseZGC", "-XX:+EnableDynamicAgentLoading", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
