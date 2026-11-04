package com.workpulse.users;

import com.workpulse.common.api.ApiResponse;
import com.workpulse.users.dto.UserDtos.ActivateUserRequest;
import com.workpulse.users.dto.UserDtos.AssignRolesRequest;
import com.workpulse.users.dto.UserDtos.InviteUserRequest;
import com.workpulse.users.dto.UserDtos.InviteUserResponse;
import com.workpulse.users.dto.UserDtos.UpdateUserRequest;
import com.workpulse.users.dto.UserDtos.UserResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "Portal user accounts and role assignment")
public class UserController {

    private final UserService userService;

    @GetMapping
    @PreAuthorize("hasAuthority('USER_VIEW')")
    public ApiResponse<List<UserResponse>> list(@RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.page(userService.list(PageRequest.of(page, Math.min(size, 200), Sort.by("displayName"))));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('USER_VIEW')")
    public ApiResponse<UserResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(userService.get(id));
    }

    @PostMapping("/invite")
    @PreAuthorize("hasAuthority('USER_CREATE')")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Invite a user; returns an activation token until email delivery is configured")
    public ApiResponse<InviteUserResponse> invite(@Valid @RequestBody InviteUserRequest request) {
        return ApiResponse.ok(userService.invite(request));
    }

    @PostMapping("/activate")
    @Operation(summary = "Activate an invited account by setting its first password")
    public ApiResponse<UserResponse> activate(@Valid @RequestBody ActivateUserRequest request) {
        return ApiResponse.ok(userService.activate(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('USER_UPDATE')")
    public ApiResponse<UserResponse> update(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest request) {
        return ApiResponse.ok(userService.update(id, request));
    }

    @PostMapping("/{id}/suspend")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<UserResponse> suspend(@PathVariable UUID id) {
        return ApiResponse.ok(userService.changeStatus(id, UserStatus.SUSPENDED));
    }

    @PostMapping("/{id}/reactivate")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<UserResponse> reactivate(@PathVariable UUID id) {
        return ApiResponse.ok(userService.changeStatus(id, UserStatus.ACTIVE));
    }

    @PostMapping("/{id}/revoke")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<UserResponse> revoke(@PathVariable UUID id) {
        return ApiResponse.ok(userService.changeStatus(id, UserStatus.REVOKED));
    }

    @PutMapping("/{id}/roles")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<UserResponse> assignRoles(@PathVariable UUID id, @Valid @RequestBody AssignRolesRequest request) {
        return ApiResponse.ok(userService.assignRoles(id, request.roles()));
    }
}
