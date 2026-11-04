package com.workpulse.teams;

import com.workpulse.common.entity.TenantEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "teams")
@Getter
@Setter
public class Team extends TenantEntity {

    @Column(name = "department_id", nullable = false)
    private UUID departmentId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 32)
    private String code;

    @Column(name = "lead_employee_id")
    private UUID leadEmployeeId;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";
}
