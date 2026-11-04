package com.workpulse.policies.dto;

import com.workpulse.policies.MonitoringPolicy;
import com.workpulse.policies.PolicyLevel;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class PolicyDtos {

    private PolicyDtos() {}

    public record PolicyResponse(UUID id, String name, PolicyLevel level, UUID targetId, boolean isDefault,
                                 Map<String, Object> workingHours, List<Map<String, Object>> collectionWindows,
                                 int idleThresholdSeconds, int samplingIntervalSeconds, boolean collectWindowTitles,
                                 boolean collectInputSummary, List<String> sensitiveAppExclusions, List<String> dataCategories,
                                 int retentionDays, String employeeNotice, String minAgentVersion, int version, String status,
                                 Instant updatedAt) {
        public static PolicyResponse from(MonitoringPolicy p) {
            return new PolicyResponse(p.getId(), p.getName(), p.getLevel(), p.getTargetId(), p.isDefaultPolicy(),
                    p.getWorkingHours(), p.getCollectionWindows(), p.getIdleThresholdSeconds(), p.getSamplingIntervalSeconds(),
                    p.isCollectWindowTitles(), p.isCollectInputSummary(), p.getSensitiveAppExclusions(), p.getDataCategories(),
                    p.getRetentionDays(), p.getEmployeeNotice(), p.getMinAgentVersion(), p.getVersion(), p.getStatus(), p.getUpdatedAt());
        }
    }

    /** The policy an agent must apply, after resolution through employee → team → department → organisation. */
    public record EffectivePolicyResponse(UUID policyId, String name, int version, String resolvedFrom,
                                          int samplingIntervalSeconds, int idleThresholdSeconds,
                                          Map<String, Object> workingHours, List<Map<String, Object>> collectionWindows,
                                          boolean collectWindowTitles, boolean collectInputSummary,
                                          List<String> sensitiveAppExclusions, List<String> dataCategories,
                                          String employeeNotice, int retentionDays, String minAgentVersion) {
        public static EffectivePolicyResponse from(MonitoringPolicy p, String resolvedFrom) {
            return new EffectivePolicyResponse(p.getId(), p.getName(), p.getVersion(), resolvedFrom,
                    p.getSamplingIntervalSeconds(), p.getIdleThresholdSeconds(), p.getWorkingHours(), p.getCollectionWindows(),
                    p.isCollectWindowTitles(), p.isCollectInputSummary(), p.getSensitiveAppExclusions(), p.getDataCategories(),
                    p.getEmployeeNotice(), p.getRetentionDays(), p.getMinAgentVersion());
        }
    }
}
