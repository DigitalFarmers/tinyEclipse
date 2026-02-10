# TinyEclipse — Admin Panel (Operations Cockpit)

## Purpose

The Admin Panel is the operational heart of TinyEclipse.
It is built for clarity, speed, and control.

This panel is not a dashboard.
It is a cockpit.

---

## Design Principles

- Minimal UI
- Zero clutter
- Fast access to critical data
- No unnecessary animations
- Dark-mode ready

---

## Global Navigation

1. Overview
2. Tenants
3. Agents
4. Sources
5. Conversations
6. Usage & Limits
7. Consents
8. Logs & Audits
9. Settings

---

## Overview

Shows:
- Active tenants
- AI usage today / month
- Alerts
- Failed escalations
- System health

Purpose:
Immediate situational awareness.

---

## Tenants

Per tenant view:
- WHMCS Client ID
- Plan (Tiny / Pro / Pro+)
- Status (Active / Suspended)
- Consent status
- Usage vs limit
- Linked agents

Actions:
- Suspend AI
- Adjust limits
- Trigger reindex

---

## Agents

Manage:
- Website Agent
- Support Agent
- Internal Ops Agent

For each agent:
- Enabled / disabled
- System prompt
- Scope
- Escalation rules

---

## Sources

Per tenant:
- URLs
- PDFs
- FAQs
- Status (indexed / failed)
- Last update

Actions:
- Re-ingest
- Remove
- Validate source

---

## Conversations

View:
- Recent conversations
- Confidence levels
- Escalations
- Channels

Export:
- Full transcript
- Metadata
- Source usage

---

## Usage & Limits

Per tenant:
- Tokens used
- Requests count
- Rate limits
- Reset dates

Warnings:
- Approaching limits
- Abuse patterns

---

## Consents

View:
- Consent accepted
- Timestamp
- IP
- User agent
- Terms version

Without consent:
- AI access is blocked

---

## Logs & Audits

Immutable logs:
- AI decisions
- Escalations
- Errors
- Security events

Purpose:
Accountability and compliance.

---

## Settings

Global:
- Default limits
- Model selection
- Escalation channels
- Maintenance mode

Only accessible to core admins.
