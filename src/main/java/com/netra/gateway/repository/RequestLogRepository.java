package com.netra.gateway.repository;

import com.netra.gateway.model.entity.RequestLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RequestLogRepository extends JpaRepository<RequestLog, UUID> {
    List<RequestLog> findByVirtualKeyOrderByCreatedAtDesc(String virtualKey, Pageable pageable);
    List<RequestLog> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
