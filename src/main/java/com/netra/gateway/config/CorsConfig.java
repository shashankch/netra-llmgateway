package com.netra.gateway.config;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;
import java.util.List;

/**
 * Enterprise CORS Configuration for NETRA Gateway.
 * 
 * Configures both:
 * 1. High-precedence CorsFilter (FilterRegistrationBean at HIGHEST_PRECEDENCE):
 *    Intercepts preflight OPTIONS and cross-origin requests before any servlet dispatcher
 *    or security layer, preventing browser CORS drops across subdomains (e.g. console to gateway).
 * 2. WebMvcConfigurer fallback mappings for standard Spring MVC endpoints.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private static final List<String> EXPOSED_HEADERS = Arrays.asList(
            "x-netra-provider",
            "x-netra-cache",
            "x-netra-cache-tier",
            "x-netra-fallback",
            "x-netra-cost-usd",
            "x-netra-route-reason",
            "x-netra-retries",
            "x-netra-escalated",
            "RateLimit-Limit",
            "RateLimit-Remaining",
            "RateLimit-Reset",
            "RateLimit-Policy",
            "Retry-After",
            "X-Total-Count",
            "X-Page-Number",
            "X-Page-Size",
            "X-Total-Pages"
    );

    @Bean
    public FilterRegistrationBean<CorsFilter> corsFilterRegistrationBean() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(EXPOSED_HEADERS);
        config.setAllowCredentials(false);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        FilterRegistrationBean<CorsFilter> bean = new FilterRegistrationBean<>(new CorsFilter(source));
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return bean;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH")
                .allowedHeaders("*")
                .exposedHeaders(EXPOSED_HEADERS.toArray(new String[0]))
                .allowCredentials(false)
                .maxAge(3600);
    }
}


