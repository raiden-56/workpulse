package com.workpulse.organizations;

import com.workpulse.config.WorkPulseProperties;
import com.workpulse.users.Role;
import com.workpulse.users.RoleRepository;
import com.workpulse.users.User;
import com.workpulse.users.UserRepository;
import com.workpulse.users.UserRole;
import com.workpulse.users.UserRoleRepository;
import com.workpulse.users.UserStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * First-run bootstrap: creates the platform super admin and a first organisation when the
 * database has no users yet. Credentials come from {@code workpulse.bootstrap.*}.
 */
@Component
@Order(1)
@RequiredArgsConstructor
@Slf4j
public class BootstrapRunner implements ApplicationRunner {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationService organizationService;
    private final PasswordEncoder passwordEncoder;
    private final WorkPulseProperties properties;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) {
            return;
        }
        WorkPulseProperties.Bootstrap bootstrap = properties.bootstrap();

        Organization org = new Organization();
        org.setName(bootstrap.organizationName());
        org.setSlug(slugify(bootstrap.organizationName()));
        org.setTimezone("Asia/Kolkata");
        org = organizationRepository.save(org);
        organizationService.createDefaults(org);

        User admin = new User();
        admin.setOrganizationId(null);
        admin.setEmail(bootstrap.adminEmail().toLowerCase());
        admin.setDisplayName("Platform Administrator");
        admin.setPasswordHash(passwordEncoder.encode(bootstrap.adminPassword()));
        admin.setPasswordChangedAt(Instant.now());
        admin.setStatus(UserStatus.ACTIVE);
        admin = userRepository.save(admin);

        Role superAdmin = roleRepository.findByCode("SUPER_ADMIN").orElseThrow();
        UserRole grant = new UserRole();
        grant.setUserId(admin.getId());
        grant.setRole(superAdmin);
        userRoleRepository.save(grant);

        log.info("Bootstrapped super admin '{}' and organisation '{}' ({})", admin.getEmail(), org.getName(), org.getId());
        log.warn("Change the bootstrap admin password immediately in non-development environments");
    }

    private static String slugify(String name) {
        String slug = name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return slug.isBlank() ? "workpulse" : slug;
    }
}
