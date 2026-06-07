---
summary: "SSH tunnel setup for ACTAgent.app connecting to a remote gateway"
read_when: "Connecting the macOS app to a remote gateway over SSH"
title: "Remote gateway setup"
---

> This content has been merged into [Remote Access](/gateway/remote#macos-persistent-ssh-tunnel-via-launchagent). See that page for the current guide.

# Running ACTAgent.app with a Remote Gateway

ACTAgent.app uses SSH tunneling to connect to a remote gateway. This guide shows you how to set it up.

## Overview

```mermaid
flowchart TB
    subgraph Client["Client Machine"]
        direction TB
        A["ACTAgent.app"]
        B["ws://127.0.0.1:19199\n(local port)"]
        T["SSH Tunnel"]

        A --> B
        B --> T
    end
    subgraph Remote["Remote Machine"]
        direction TB
        C["Gateway WebSocket"]
        D["ws://127.0.0.1:19199"]

        C --> D
    end
    T --> C
```

## Quick setup

### Step 1: Add SSH Config

Edit `~/.ssh/config` and add:

```ssh
Host remote-gateway
    HostName <REMOTE_IP>          # e.g., 172.27.187.184
    User <REMOTE_USER>            # e.g., jefferson
    LocalForward 19199 127.0.0.1:19199
    IdentityFile ~/.ssh/id_rsa
```

Replace `<REMOTE_IP>` and `<REMOTE_USER>` with your values.

### Step 2: Copy SSH Key

Copy your public key to the remote machine (enter password once):

```bash
ssh-copy-id -i ~/.ssh/id_rsa <REMOTE_USER>@<REMOTE_IP>
```

### Step 3: Configure Remote Gateway Auth

```bash
actagent config set gateway.remote.token "<your-token>"
```

Use `gateway.remote.password` instead if your remote gateway uses password auth.
`ACTAGENT_GATEWAY_TOKEN` is still valid as a shell-level override, but the durable
remote-client setup is `gateway.remote.token` / `gateway.remote.password`.

### Step 4: Start SSH Tunnel

```bash
ssh -N remote-gateway &
```

### Step 5: Restart ACTAgent.app

```bash
# Quit ACTAgent.app (⌘Q), then reopen:
open /path/to/ACTAgent.app
```

The app will now connect to the remote gateway through the SSH tunnel.

---

## Auto-Start Tunnel on Login

To have the SSH tunnel start automatically when you log in, create a Launch Agent.

### Create the PLIST file

Save this as `~/Library/LaunchAgents/ai.actagent.ssh-tunnel.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.actagent.ssh-tunnel</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/ssh</string>
        <string>-N</string>
        <string>remote-gateway</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

### Load the Launch Agent

```bash
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/ai.actagent.ssh-tunnel.plist
```

The tunnel will now:

- Start automatically when you log in
- Restart if it crashes
- Keep running in the background

Legacy note: remove any leftover `com.actagent.ssh-tunnel` LaunchAgent if present.

---

## Troubleshooting

**Check if tunnel is running:**

```bash
ps aux | grep "ssh -N remote-gateway" | grep -v grep
lsof -i :19199
```

**Restart the tunnel:**

```bash
launchctl kickstart -k gui/$UID/ai.actagent.ssh-tunnel
```

**Stop the tunnel:**

```bash
launchctl bootout gui/$UID/ai.actagent.ssh-tunnel
```

---

## How it works

| Component                            | What It Does                                                 |
| ------------------------------------ | ------------------------------------------------------------ |
| `LocalForward 19199 127.0.0.1:19199` | Forwards local port 19199 to remote port 19199               |
| `ssh -N`                             | SSH without executing remote commands (just port forwarding) |
| `KeepAlive`                          | Automatically restarts tunnel if it crashes                  |
| `RunAtLoad`                          | Starts tunnel when the agent loads                           |

ACTAgent.app connects to `ws://127.0.0.1:19199` on your client machine. The SSH tunnel forwards that connection to port 19199 on the remote machine where the Gateway is running.

## Related

- [Remote access](/gateway/remote)
- [Tailscale](/gateway/tailscale)
