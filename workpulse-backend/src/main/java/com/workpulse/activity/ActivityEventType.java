package com.workpulse.activity;

/** Event types accepted from the desktop agent (see docs/api/EVENT_CONTRACTS.md). */
public enum ActivityEventType {
    AGENT_STARTED, AGENT_STOPPED, AGENT_HEARTBEAT,
    SESSION_START, SESSION_END, SESSION_LOCK, SESSION_UNLOCK,
    FOREGROUND_APP, IDLE_START, IDLE_END, INPUT_SUMMARY,
    BREAK_START, BREAK_END,
    NETWORK_OFFLINE, NETWORK_ONLINE,
    POLICY_APPLIED, DEVICE_INFO,
    UNKNOWN;

    public static ActivityEventType fromString(String value) {
        if (value == null) {
            return UNKNOWN;
        }
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return UNKNOWN;
        }
    }
}
