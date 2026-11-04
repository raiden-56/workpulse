package com.workpulse.applications;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * In-memory view of the global application catalogue. Organisation and role-profile overrides
 * (application_classifications) are layered on top in Phase 7.
 */
@Service
@RequiredArgsConstructor
public class ApplicationCatalogService {

    private final ApplicationCatalogRepository repository;
    private final Map<String, ApplicationCatalog> byProcess = new ConcurrentHashMap<>();
    private final AtomicBoolean loaded = new AtomicBoolean(false);

    public Optional<ApplicationCatalog> find(String processName) {
        ensureLoaded();
        if (processName == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(byProcess.get(processName.toLowerCase(Locale.ROOT)));
    }

    public ApplicationCategory categoryOf(String processName) {
        return find(processName).map(ApplicationCatalog::getDefaultCategory).orElse(ApplicationCategory.NEUTRAL);
    }

    public boolean isClassified(String processName) {
        return find(processName).isPresent();
    }

    public String displayNameOf(String processName, String fallback) {
        return find(processName).map(ApplicationCatalog::getDisplayName)
                .orElse(fallback == null || fallback.isBlank() ? processName : fallback);
    }

    @Scheduled(fixedDelay = 600_000, initialDelay = 600_000)
    public void refresh() {
        Map<String, ApplicationCatalog> fresh = new ConcurrentHashMap<>();
        repository.findAll().forEach(app -> fresh.put(app.getProcessName().toLowerCase(Locale.ROOT), app));
        byProcess.clear();
        byProcess.putAll(fresh);
        loaded.set(true);
    }

    private void ensureLoaded() {
        if (loaded.compareAndSet(false, true)) {
            repository.findAll().forEach(app -> byProcess.put(app.getProcessName().toLowerCase(Locale.ROOT), app));
        }
    }
}
