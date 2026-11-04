package com.workpulse.employees.dto;

import com.workpulse.employees.EmploymentStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public final class EmployeeDtos {

    private EmployeeDtos() {}

    public record EmployeeResponse(UUID id, String employeeCode, String firstName, String lastName, String fullName,
                                   String workEmail, String designation, UUID departmentId, String departmentName,
                                   UUID teamId, String teamName, UUID managerEmployeeId, String managerName,
                                   UUID shiftId, String shiftName, LocalDate joiningDate, EmploymentStatus employmentStatus,
                                   String roleProfile, long deviceCount, String liveStatus, boolean hasPortalUser) {}

    public record CreateEmployeeRequest(@NotBlank @Size(max = 40) String employeeCode,
                                        @NotBlank @Size(max = 80) String firstName,
                                        @NotBlank @Size(max = 80) String lastName,
                                        @NotBlank @Email @Size(max = 255) String workEmail,
                                        @Size(max = 120) String designation,
                                        UUID departmentId, UUID teamId, UUID shiftId, UUID managerEmployeeId,
                                        LocalDate joiningDate,
                                        @Size(max = 40) String roleProfile) {}

    public record UpdateEmployeeRequest(@NotBlank @Size(max = 80) String firstName,
                                        @NotBlank @Size(max = 80) String lastName,
                                        @NotBlank @Email @Size(max = 255) String workEmail,
                                        @Size(max = 120) String designation,
                                        UUID departmentId, UUID teamId, UUID shiftId,
                                        LocalDate joiningDate,
                                        EmploymentStatus employmentStatus,
                                        @Size(max = 40) String roleProfile) {}

    public record AssignManagerRequest(@NotNull UUID managerEmployeeId) {}

    public record AssignDepartmentRequest(@NotNull UUID departmentId) {}

    public record AssignTeamRequest(@NotNull UUID teamId) {}

    public record EmployeeFilter(String q, UUID departmentId, UUID teamId, EmploymentStatus status, String roleProfile) {}
}
