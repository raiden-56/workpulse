package com.workpulse.shifts;

import com.workpulse.common.entity.TenantEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalTime;
import java.util.List;

@Entity
@Table(name = "shifts")
@Getter
@Setter
public class Shift extends TenantEntity {

    @Column(nullable = false, length = 80)
    private String name;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(nullable = false, length = 64)
    private String timezone = "UTC";

    /** ISO day numbers, 1 = Monday … 7 = Sunday. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "working_days", columnDefinition = "jsonb", nullable = false)
    private List<Integer> workingDays = List.of(1, 2, 3, 4, 5);

    @Column(name = "grace_minutes", nullable = false)
    private int graceMinutes = 10;

    @Column(name = "break_minutes", nullable = false)
    private int breakMinutes = 60;

    @Column(name = "overtime_after_minutes", nullable = false)
    private int overtimeAfterMinutes = 540;

    @Column(name = "is_default", nullable = false)
    private boolean defaultShift = false;
}
