package com.netra.gateway.repository;

import com.netra.gateway.model.entity.ModelPricing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ModelPricingRepository extends JpaRepository<ModelPricing, String> {
    Optional<ModelPricing> findByModel(String model);
}
