package com.netra.gateway.repository;

import com.netra.gateway.model.entity.MonthlySpend;
import com.netra.gateway.model.entity.MonthlySpendId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface MonthlySpendRepository extends JpaRepository<MonthlySpend, MonthlySpendId> {
    Optional<MonthlySpend> findByVirtualKeyAndYearMonth(String virtualKey, String yearMonth);
    List<MonthlySpend> findByVirtualKey(String virtualKey);

    @Modifying
    @Query(value = """
        INSERT INTO monthly_spend (virtual_key, year_month, total_spend_usd, request_count, total_prompt_tokens, total_completion_tokens, cache_hits)
        VALUES (:vkey, :ym, :cost, 1, :pTokens, :cTokens, :cacheHit)
        ON CONFLICT (virtual_key, year_month) DO UPDATE SET
            total_spend_usd = monthly_spend.total_spend_usd + EXCLUDED.total_spend_usd,
            request_count = monthly_spend.request_count + 1,
            total_prompt_tokens = monthly_spend.total_prompt_tokens + EXCLUDED.total_prompt_tokens,
            total_completion_tokens = monthly_spend.total_completion_tokens + EXCLUDED.total_completion_tokens,
            cache_hits = monthly_spend.cache_hits + EXCLUDED.cache_hits
        """, nativeQuery = true)
    void upsertSpend(
            @Param("vkey") String virtualKey,
            @Param("ym") String yearMonth,
            @Param("cost") BigDecimal cost,
            @Param("pTokens") int promptTokens,
            @Param("cTokens") int completionTokens,
            @Param("cacheHit") int cacheHit
    );
}
