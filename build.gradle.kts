plugins {
    java
    id("org.springframework.boot") version "4.1.1"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.netra.gateway"
version = "0.7.1"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(25))
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // Web & HTTP Virtual Threads
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // Database & pgvector Persistence
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.postgresql:postgresql")
    implementation("com.pgvector:pgvector:0.1.6")
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")

    // Redis
    implementation("org.springframework.boot:spring-boot-starter-data-redis")

    // In-JVM ONNX Embeddings (all-MiniLM-L6-v2)
    implementation("dev.langchain4j:langchain4j-embeddings-all-minilm-l6-v2-q:0.36.2")

    // In-Memory L1 Cache (High-Throughput Near-Cache)
    implementation("com.github.ben-manes.caffeine:caffeine")

    // Resilience & Fault Tolerance (Phase 7)
    implementation("io.github.resilience4j:resilience4j-circuitbreaker:2.2.0")

    // Jackson JSON
    implementation("com.fasterxml.jackson.core:jackson-databind")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310")

    // Lombok
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    // Testing
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testCompileOnly("org.projectlombok:lombok")
    testAnnotationProcessor("org.projectlombok:lombok")
}

tasks.withType<JavaCompile> {
    options.encoding = "UTF-8"
    options.compilerArgs.addAll(listOf("-parameters", "-Xlint:unchecked", "-Xlint:deprecation"))
}

tasks.named<ProcessResources>("processResources") {
    from("data") {
        into("data")
    }
}

springBoot {
    buildInfo()
}

tasks.named<Jar>("jar") {
    enabled = false
}

tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    archiveFileName.set("app.jar")
}

tasks.withType<Test> {
    useJUnitPlatform()
    jvmArgs("-XX:+EnableDynamicAgentLoading", "-Djdk.tracePinnedThreads=full")
}
