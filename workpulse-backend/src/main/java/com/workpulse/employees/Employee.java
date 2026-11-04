package com.workpulse.employees;

import com.workpulse.common.entity.TenantEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "employees")
@Getter
@Setter
public class Employee extends TenantEntity {

    @Column(name = "employee_code", nullable = false, length = 40)
    private String employeeCode;

    @Column(name = "first_name", nullable = false, length = 80)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 80)
    private String lastName;

    @Column(name = "work_email", nullable = false)
    private String workEmail;

    @Column(length = 120)
    private String designation;

    @Column(name = "department_id")
    private UUID departmentId;

    @Column(name = "team_id")
    private UUID teamId;

    @Column(name = "shift_id")
    private UUID shiftId;

    @Column(name = "joining_date")
    private LocalDate joiningDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "employment_status", nullable = false, length = 20)
    private EmploymentStatus employmentStatus = EmploymentStatus.ACTIVE;

    /** Drives application classification (e.g. DEVELOPER, ANALYST, DESIGNER, SUPPORT, GENERAL). */
    @Column(name = "role_profile", nullable = false, length = 40)
    private String roleProfile = "GENERAL";

    public String getFullName() {
        return firstName + " " + lastName;
    }
}
