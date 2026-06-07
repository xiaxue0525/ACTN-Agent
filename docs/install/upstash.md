---
summary: "Host ACTAgent on Upstash Box with keep-alive and SSH tunnel access"
read_when:
  - Deploying ACTAgent to Upstash Box
  - You want a managed Linux environment for ACTAgent with SSH-tunneled dashboard access
title: "Upstash Box"
---

Run a persistent ACTAgent Gateway on Upstash Box, a managed Linux environment
with keep-alive lifecycle support.

Use an SSH tunnel for dashboard access. Do not expose the Gateway port directly
to the public internet.

## Prerequisites

- Upstash account
- Keep-alive Upstash Box
- SSH client on your local machine

## Create a Box

Create a keep-alive Box in the Upstash Console. Note the Box ID, such as
`right-flamingo-14486`, and your Box API key.

Upstash maintains its current ACTAgent Box walkthrough at
[ACTAgent Setup](https://upstash.com/docs/box/guides/actagent-setup).

## Connect with an SSH tunnel

Forward the ACTAgent dashboard port to your local machine. Use your Box API key
as the SSH password when prompted:

```bash
ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -L 19199:127.0.0.1:19199 <box-id>@us-east-1.box.upstash.com
```

The keepalive options reduce idle tunnel drops during onboarding.

## Install ACTAgent

Inside the Box:

```bash
sudo npm install -g actagent
```

## Run onboarding

```bash
actagent onboard --install-daemon
```

Follow the prompts. Copy the dashboard URL and token when onboarding finishes.

## Start the Gateway

Configure the Gateway for the Box network and start it in the background:

```bash
actagent config set gateway.bind lan
nohup actagent gateway > gateway.log 2>&1 &
```

With the SSH tunnel active, open the dashboard URL locally:

```text
http://127.0.0.1:19199/#token=<your-token>
```

## Auto-restart

Set this command as the Box init script so the Gateway restarts when the Box
starts:

```bash
nohup actagent gateway > gateway.log 2>&1 &
```

## Troubleshooting

If SSH freezes during onboarding, reconnect with a clean SSH config and
keepalives:

```bash
ssh -F /dev/null -o ControlMaster=no -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -L 19199:127.0.0.1:19199 <box-id>@us-east-1.box.upstash.com
```

This bypasses stale local `~/.ssh/config` settings and keeps the tunnel active
through idle network periods.

## Related

- [Remote access](/gateway/remote)
- [Gateway security](/gateway/security)
- [Updating ACTAgent](/install/updating)
