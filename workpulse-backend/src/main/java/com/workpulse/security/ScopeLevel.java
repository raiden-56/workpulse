package com.workpulse.security;

/** Data-visibility level attached to a role grant. Ordered from widest to narrowest. */
public enum ScopeLevel {
    GLOBAL, ORGANIZATION, DEPARTMENT, TEAM, SELF
}
