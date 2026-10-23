package com.netra.gateway.model.entity;

import lombok.*;

import java.io.Serializable;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class MonthlySpendId implements Serializable {
    private String virtualKey;
    private String yearMonth;
}
