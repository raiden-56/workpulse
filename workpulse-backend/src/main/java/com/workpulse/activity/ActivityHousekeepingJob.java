package com.workpulse.activity;

import com.workpulse.config.WorkPulseProperties;
import com.workpulse.devices.DeviceHealth;
import com.workpulse.devices.DeviceRepository;
import com.workpulse.devices.DeviceStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

/**
 * Keeps derived state honest when agents go silent, and makes sure future partitions exist.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ActivityHousekeepingJob {

    private final LiveStatusRepository liveStatusRepository;
    private final DeviceRepository deviceRepository;
    private final JdbcTemplate jdbc;
    private final WorkPulseProperties properties;

    @Scheduled(fixedDelayString = "PT60S", initialDelayString = "PT30S")
    @Transactional
    public void markSilentAgentsOffline() {
        Instant now = Instant.now();
        Instant cutoff = now.minus(properties.agent().offlineAfter());
        int statuses = liveStatusRepository.markOffline(cutoff, now);
        int devices = deviceRepository.markStaleDevices(DeviceStatus.APPROVED, cutoff.minus(properties.agent().offlineAfter()), DeviceHealth.OFFLINE);
        if (statuses > 0 || devices > 0) {
            log.debug("Housekeeping: {} employees marked offline, {} devices marked offline", statuses, devices);
        }
    }

    /** Creates monthly partitions three months ahead for the high-volume tables. */
    @Scheduled(cron = "0 15 1 * * *")
    @Transactional
    public void ensurePartitions() {
        LocalDate month = LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1);
        for (int i = 0; i <= 3; i++) {
            LocalDate m = month.plusMonths(i);
            for (String table : new String[]{"activity_events", "application_usage"}) {
                String name = table + "_" + m.getYear() + String.format("%02d", m.getMonthValue());
                jdbc.execute(String.format("CREATE TABLE IF NOT EXISTS %s PARTITION OF %s FOR VALUES FROM ('%s') TO ('%s')",
                        name, table, m, m.plusMonths(1)));
            }
        }
    }
}
