package com.netra.gateway.model.entity;

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

    @Column(name = "input_per_1m", nullable = false, precision = 10, scale = 4)
    private BigDecimal inputPer1m;

    @Column(name = "output_per_1m", nullable = false, precision = 10, scale = 4)
    private BigDecimal outputPer1m;

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();
}
