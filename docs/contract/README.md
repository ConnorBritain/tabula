# Tabula server contract

> **What this is.** The public contract between the Tabula apps and the Tabula server: what an app sends and what it gets back.
> **The server is closed source.** This folder lets schools and families check what the server sends to a device.
> **Source.** Edited from the server's docs, as of 2026-11-21.
> **Date.** 2026-11-25.

## Why this is public

The owner decided ([docs/architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md) §8): the app stays AGPL in this repo. The server may be private. The contract is public, so anyone can check the API shapes and, later, the data rules.

## Files

| File | What it holds |
|---|---|
| [API.md](API.md) | The routes an app calls, the request and reply shapes, the error codes and the cookies. |
| [ai-replies-v1.json](ai-replies-v1.json) | The JSON Schema for each hosted AI reply. The server checks each reply against it. The app reads the reply with the same shape. A byte copy of the server's file. |
| [../../fixtures/platform-v2.json](../../fixtures/platform-v2.json) | The feature keys, the settings registry, and sample capability records made by the real server. The app tests read this file. |

## What is not here

These docs cover only what a device sends and gets back. Data rules: coming later. They do not cover how the server works inside: billing, prices, plans, cost, abuse checks, limit values, AI prompts, the admin console, or server settings that only operators use.

`fixtures/platform-v2.json` is the public part of the server's contract file. Plan, entitlement, invite and limit-default entries are left out. One sample record name and its note were made neutral (`pool-no-funds`). All other kept values are as the server made them.

If you find a mismatch between these docs and what the server sends, please open an issue.

## How to update

When the server contract changes:

1. Copy `ai-replies-v1.json` byte for byte. Copy the server's contract file to `fixtures/platform-v2.json`, then remove the plan, entitlement, invite and limit-default entries again, and make record names and notes neutral again. Run `node --test`.
2. Edit `API.md` by hand. Read every changed line. Keep only what a device sends and gets back.
3. Change the date in every header, this file included.

Section numbers such as "AI-POLICY §3" point to those docs in this repo.
