package ai.actagent.app.ui

import ai.actagent.app.GatewayChannelSummary
import ai.actagent.app.GatewayChannelsSummary
import ai.actagent.app.MainViewModel
import ai.actagent.app.ui.design.actagentdetailRow
import ai.actagent.app.ui.design.ACTAgentListPanel
import ai.actagent.app.ui.design.ACTAgentPanel
import ai.actagent.app.ui.design.ACTAgentSecondaryButton
import ai.actagent.app.ui.design.ACTAgentStatus
import ai.actagent.app.ui.design.ACTAgentStatusPill
import ai.actagent.app.ui.design.ACTAgentTextBadge
import ai.actagent.app.ui.design.ACTAgentTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** Settings screen for gateway channel readiness and account status. */
@Composable
internal fun ChannelsSettingsScreen(
  viewModel: MainViewModel,
  onBack: () -> Unit,
) {
  val summary by viewModel.channelsSummary.collectAsState()
  val refreshing by viewModel.channelsRefreshing.collectAsState()
  val errorText by viewModel.channelsErrorText.collectAsState()
  val isConnected by viewModel.isConnected.collectAsState()
  val channels = summary.channels

  LaunchedEffect(isConnected) {
    if (isConnected) {
      viewModel.refreshChannels()
    }
  }

  SettingsDetailFrame(
    title = "Channels",
    subtitle = "Messaging surfaces connected to this gateway.",
    icon = Icons.Default.Notifications,
    onBack = onBack,
  ) {
    SettingsMetricPanel(
      rows =
        listOf(
          SettingsMetric("Channels", channels.size.toString()),
          SettingsMetric("Connected", channels.count { it.connected }.toString()),
          SettingsMetric("Configured", channels.count { it.configured }.toString()),
          SettingsMetric("Issues", channels.count { it.error != null }.toString()),
        ),
    )
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      ACTAgentSecondaryButton(
        text = if (refreshing) "Refreshing" else "Refresh",
        onClick = viewModel::refreshChannels,
        enabled = isConnected && !refreshing,
        modifier = Modifier.weight(1f),
      )
    }
    errorText?.let { error ->
      ACTAgentPanel {
        Text(text = error, style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.warning)
      }
    }
    if (summary.partial || summary.warnings.isNotEmpty()) {
      // Partial channel scans still include useful rows; surface the warning
      // without hiding successful channel status.
      ACTAgentPanel {
        Text(text = channelsWarningText(summary), style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.textMuted)
      }
    }
    when {
      !isConnected ->
        ACTAgentPanel {
          Text(text = "Connect the gateway to load channels.", style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.textMuted)
        }
      channels.isEmpty() ->
        ACTAgentPanel {
          Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(text = "No channels found.", style = ACTAgentTheme.type.section, color = ACTAgentTheme.colors.text)
            Text(text = "Telegram, WhatsApp, email, and other channels appear here after setup.", style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.textMuted)
          }
        }
      else -> ChannelsPanel(channels = channels)
    }
  }
}

@Composable
private fun ChannelsPanel(channels: List<GatewayChannelSummary>) {
  ACTAgentListPanel(items = channels) { channel ->
    ChannelRow(channel = channel)
  }
}

@Composable
private fun ChannelRow(channel: GatewayChannelSummary) {
  actagentdetailRow(
    title = channel.label,
    subtitle = channelSubtitle(channel),
    leading = { ACTAgentTextBadge(text = channelBadge(channel.label)) },
    trailing = { ACTAgentStatusPill(text = channelStatusText(channel), status = channelStatus(channel)) },
  )
}

private fun channelSubtitle(channel: GatewayChannelSummary): String {
  val accounts =
    when (channel.accountCount) {
      0 -> null
      1 -> "1 account"
      else -> "${channel.accountCount} accounts"
    }
  val lifecycle =
    when {
      channel.connected -> "Connected"
      channel.running -> "Running"
      channel.linked -> "Linked"
      channel.configured -> "Configured"
      channel.enabled -> "Enabled"
      else -> "Off"
    }
  return listOfNotNull(accounts, lifecycle, channel.error).joinToString(" · ")
}

private fun channelStatusText(channel: GatewayChannelSummary): String =
  when {
    channel.error != null -> "Issue"
    channel.connected -> "Connected"
    channel.running -> "Running"
    channel.linked || channel.configured -> "Ready"
    channel.enabled -> "Setup"
    else -> "Off"
  }

private fun channelStatus(channel: GatewayChannelSummary): ACTAgentStatus =
  when {
    channel.error != null -> ACTAgentStatus.Danger
    channel.connected || channel.running -> ACTAgentStatus.Success
    channel.linked || channel.configured -> ACTAgentStatus.Neutral
    channel.enabled -> ACTAgentStatus.Warning
    else -> ACTAgentStatus.Neutral
  }

private fun channelBadge(label: String): String =
  label
    .split(' ', '-', '_')
    .filter { it.isNotBlank() }
    .take(2)
    .mapNotNull { it.firstOrNull()?.uppercaseChar()?.toString() }
    .joinToString("")
    .ifBlank { "C" }

/** Chooses the first gateway warning or a generic partial-scan message. */
private fun channelsWarningText(summary: GatewayChannelsSummary): String = summary.warnings.firstOrNull()?.takeIf { it.isNotBlank() } ?: "Some channel status checks did not complete."
