package com.netra.gateway.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH")
                .allowedHeaders("*")
                .exposedHeaders(
                        "x-netra-provider",
                        "x-netra-cache",
                        "x-netra-fallback",
                        "x-netra-cost-usd",
                        "x-netra-route-reason",
                        "x-netra-retries",
                        "RateLimit-Limit",
                        "RateLimit-Remaining",
                        "RateLimit-Reset",
                        "RateLimit-Policy",
                        "Retry-After"
                )
                .allowCredentials(false)
                .maxAge(3600);
    }
}
