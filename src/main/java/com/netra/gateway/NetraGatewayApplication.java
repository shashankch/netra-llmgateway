package com.netra.gateway;

import com.netra.gateway.config.GatewayConfigProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(GatewayConfigProperties.class)
public class NetraGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(NetraGatewayApplication.class, args);
    }
}
