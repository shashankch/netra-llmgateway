package com.netra.gateway.model.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "model_pricing")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ModelPricing {

    @Id
    @Column(nullable = false, length = 64)
    private String model;

    @Column(nullable = false, length = 64)
    private String provider;

    @JsonProperty("input_per_1m")
    @Column(name = "input_per_1m", nullable = false, precision = 10, scale = 4)
    private BigDecimal inputPer1m;

    @JsonProperty("output_per_1m")
    @Column(name = "output_per_1m", nullable = false, precision = 10, scale = 4)
    private BigDecimal outputPer1m;

    @JsonProperty("created_at")
    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();
}
