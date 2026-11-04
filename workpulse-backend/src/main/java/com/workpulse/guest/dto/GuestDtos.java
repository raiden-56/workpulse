package com.workpulse.guest.dto;

import jakarta.validation.constraints.Size;

import java.util.List;

public final class GuestDtos {

    private GuestDtos() {}

    public record Persona(String code, String label, String description, String roleCode) {}

    public record GuestConfigResponse(boolean enabled, String organizationName, List<Persona> personas, long sessionTtlMinutes,
                                      String notice, List<DemoCredential> demoLogins) {}

    public record DemoCredential(String roleCode, String label, String email, String password) {}

    public record CreateGuestSessionRequest(@Size(max = 30) String persona) {}

    public record ResetResponse(String message, int employees, long events) {}
}
