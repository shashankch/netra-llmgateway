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

# Extract Spring Boot layers using modern jarmode tools (Spring Boot 3.3+ / 4.x)
RUN java -Djarmode=tools -jar build/libs/*.jar extract --layers --launcher --destination extracted

# Runtime stage
FROM eclipse-temurin:25-jre
WORKDIR /app

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Create non-root execution user
RUN groupadd -r netra && useradd -r -g netra -u 10001 netra

# Copy layered artifacts from builder in order of change frequency (Docker layer caching)
COPY --chown=netra:netra --from=builder /workspace/extracted/dependencies/ ./
COPY --chown=netra:netra --from=builder /workspace/extracted/spring-boot-loader/ ./
COPY --chown=netra:netra --from=builder /workspace/extracted/snapshot-dependencies/ ./
COPY --chown=netra:netra --from=builder /workspace/extracted/application/ ./
COPY --chown=netra:netra --from=builder /workspace/data /app/data/
# Retain executable JAR for platforms/templates invoking java -jar app.jar
COPY --chown=netra:netra --from=builder /workspace/build/libs/app.jar /app/app.jar

USER netra

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["java", "-XX:+UseZGC", "-XX:+EnableDynamicAgentLoading", "-Djava.security.egd=file:/dev/./urandom", "org.springframework.boot.loader.launch.JarLauncher"]
