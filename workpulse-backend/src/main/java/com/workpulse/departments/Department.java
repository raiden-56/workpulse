package com.workpulse.departments;

import com.workpulse.common.entity.TenantEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "departments")
@Getter
@Setter
public class Department extends TenantEntity {

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 32)
    private String code;

    @Column(name = "parent_id")
    private UUID parentId;

    @Column(name = "head_employee_id")
    private UUID headEmployeeId;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";
}
