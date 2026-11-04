package com.workpulse.users;

import com.workpulse.common.api.ApiResponse;
import com.workpulse.users.dto.UserDtos.PermissionResponse;
import com.workpulse.users.dto.UserDtos.RoleResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Roles", description = "Role and permission catalogue")
public class RoleController {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;

    @GetMapping("/roles")
    @PreAuthorize("hasAuthority('ROLE_VIEW') or hasAuthority('USER_MANAGE')")
    @Transactional(readOnly = true)
    public ApiResponse<List<RoleResponse>> roles() {
        return ApiResponse.ok(roleRepository.findAllByOrderByCodeAsc().stream()
                .map(r -> new RoleResponse(r.getId(), r.getCode(), r.getName(), r.getDescription(), r.getScopeLevel(),
                        r.getPermissions().stream().map(Permission::getCode).sorted().toList()))
                .toList());
    }

    @GetMapping("/permissions")
    @PreAuthorize("hasAuthority('ROLE_VIEW') or hasAuthority('USER_MANAGE')")
    public ApiResponse<List<PermissionResponse>> permissions() {
        return ApiResponse.ok(permissionRepository.findAllByOrderByResourceAscActionAsc().stream()
                .map(p -> new PermissionResponse(p.getId(), p.getCode(), p.getResource(), p.getAction(), p.getDescription()))
                .toList());
    }
}
