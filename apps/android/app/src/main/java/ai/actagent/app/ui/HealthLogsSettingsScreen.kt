package ai.actagent.app.ui

import ai.actagent.app.GatewayHealthLogsSummary
import ai.actagent.app.GatewayLogEntry
import ai.actagent.app.MainViewModel
import ai.actagent.app.ui.design.ACTAgentPanel
import ai.actagent.app.ui.design.ACTAgentSecondaryButton
import ai.actagent.app.ui.design.ACTAgentStatus
import ai.actagent.app.ui.design.ACTAgentStatusPill
import ai.actagent.app.ui.design.ACTAgentTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

/** Settings health screen for gateway/node status and recent gateway logs. */
@Composable
internal fun HealthLogsSettingsScreen(
  viewModel: MainViewModel,
  onBack: () -> Unit,
) {
  val isConnected by viewModel.isConnected.collectAsState()
  val isNodeConnected by viewModel.isNodeConnected.collectAsState()
  val chatHealthOk by viewModel.chatHealthOk.collectAsState()
  val statusText by viewModel.statusText.collectAsState()
  val modelCount by viewModel.modelCatalog.collectAsState()
  val pendingRunCount by viewModel.pendingRunCount.collectAsState()
  val talkStatus by viewModel.talkModeStatusText.collectAsState()
  val logsSummary by viewModel.healthLogsSummary.collectAsState()
  val logsRefreshing by viewModel.healthLogsRefreshing.collectAsState()
  val logsErrorText by viewModel.healthLogsErrorText.collectAsState()

  LaunchedEffect(isConnected) {
    if (isConnected) {
      // Load logs when the gateway becomes available; manual refresh covers
      // later updates so this screen does not poll.
      viewModel.refreshHealthLogs()
    }
  }

  SettingsDetailFrame(
    title = "Health",
    subtitle = "Gateway status, phone node readiness, and recent log stream.",
    icon = Icons.Default.Settings,
    onBack = onBack,
  ) {
    SettingsMetricPanel(
      rows =
        listOf(
          SettingsMetric("Gateway", if (isConnected) "Online" else "Offline"),
          SettingsMetric("Node", if (isNodeConnected) "Online" else "Waiting"),
          SettingsMetric("Models", modelCount.size.toString()),
          SettingsMetric("Logs", logsSummary.entries.size.toString()),
        ),
    )
    HealthStatusPanel(
      gateway = statusText,
      node = if (isNodeConnected) "Online" else "Waiting",
      chat = if (chatHealthOk) "Ready" else "Needs connection",
      models = "${modelCount.size} available",
      voice = talkStatus,
      runs = if (pendingRunCount > 0) "$pendingRunCount active" else "Idle",
      isConnected = isConnected,
      isNodeConnected = isNodeConnected,
      chatHealthOk = chatHealthOk,
      modelsReady = modelCount.isNotEmpty(),
      voiceReady = talkStatus.lowercase() != "off",
    )
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      ACTAgentSecondaryButton(
        text = if (logsRefreshing) "Refreshing" else "Refresh Logs",
        onClick = viewModel::refreshHealthLogs,
        enabled = isConnected && !logsRefreshing,
        modifier = Modifier.weight(1f),
      )
    }
    logsErrorText?.let { error ->
      ACTAgentPanel {
        Text(text = error, style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.warning)
      }
    }
    GatewayLogsPanel(isConnected = isConnected, summary = logsSummary)
  }
}

@Composable
private fun HealthStatusPanel(
  gateway: String,
  node: String,
  chat: String,
  models: String,
  voice: String,
  runs: String,
  isConnected: Boolean,
  isNodeConnected: Boolean,
  chatHealthOk: Boolean,
  modelsReady: Boolean,
  voiceReady: Boolean,
) {
  ACTAgentPanel(contentPadding = PaddingValues(horizontal = 0.dp, vertical = 0.dp)) {
    Column {
      HealthStatusRow(title = "Gateway", value = gateway, healthy = isConnected)
      HorizontalDivider(color = ACTAgentTheme.colors.border, thickness = 1.dp)
      HealthStatusRow(title = "Phone Node", value = node, healthy = isNodeConnected)
      HorizontalDivider(color = ACTAgentTheme.colors.border, thickness = 1.dp)
      HealthStatusRow(title = "Chat", value = chat, healthy = chatHealthOk)
      HorizontalDivider(color = ACTAgentTheme.colors.border, thickness = 1.dp)
      HealthStatusRow(title = "Models", value = models, healthy = modelsReady)
      HorizontalDivider(color = ACTAgentTheme.colors.border, thickness = 1.dp)
      HealthStatusRow(title = "Voice", value = voice, healthy = voiceReady)
      HorizontalDivider(color = ACTAgentTheme.colors.border, thickness = 1.dp)
      HealthStatusRow(title = "Runs", value = runs, healthy = true)
    }
  }
}

@Composable
private fun HealthStatusRow(
  title: String,
  value: String,
  healthy: Boolean,
) {
  Row(
    modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 7.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(9.dp),
  ) {
    Text(text = title, style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.text, modifier = Modifier.weight(1f), maxLines = 1)
    ACTAgentStatusPill(text = value, status = if (healthy) ACTAgentStatus.Success else ACTAgentStatus.Warning)
  }
}

@Composable
private fun GatewayLogsPanel(
  isConnected: Boolean,
  summary: GatewayHealthLogsSummary,
) {
  Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
      Text(text = "RECENT LOGS", style = ACTAgentTheme.type.caption, color = ACTAgentTheme.colors.textMuted)
      summary.fileName?.let { fileName ->
        Text(text = fileName, style = ACTAgentTheme.type.caption, color = ACTAgentTheme.colors.textSubtle, maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
    }
    when {
      !isConnected ->
        ACTAgentPanel {
          Text(text = "Connect the gateway to load recent logs.", style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.textMuted)
        }
      summary.entries.isEmpty() ->
        ACTAgentPanel {
          Text(text = "No recent log entries.", style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.textMuted)
        }
      else ->
        ACTAgentPanel(contentPadding = PaddingValues(horizontal = 0.dp, vertical = 0.dp)) {
          val entries = summary.entries.takeLast(12)
          Column {
            entries.forEachIndexed { index, entry ->
              GatewayLogRow(entry = entry)
              if (index != entries.lastIndex) {
                HorizontalDivider(color = ACTAgentTheme.colors.border, thickness = 1.dp)
              }
            }
          }
        }
    }
    if (summary.truncated) {
      Text(text = "Showing the latest log chunk.", style = ACTAgentTheme.type.caption, color = ACTAgentTheme.colors.textSubtle)
    }
  }
}

@Composable
private fun GatewayLogRow(entry: GatewayLogEntry) {
  Row(
    modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 7.dp),
    verticalAlignment = Alignment.Top,
    horizontalArrangement = Arrangement.spacedBy(9.dp),
  ) {
    Text(text = compactLogTime(entry.time), style = ACTAgentTheme.type.caption, color = ACTAgentTheme.colors.textSubtle, modifier = Modifier.weight(0.72f), maxLines = 1)
    Column(modifier = Modifier.weight(2.7f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
      Text(text = entry.message, style = ACTAgentTheme.type.caption, color = ACTAgentTheme.colors.text, maxLines = 2, overflow = TextOverflow.Ellipsis)
      entry.subsystem?.let { subsystem ->
        Text(text = subsystem, style = ACTAgentTheme.type.caption, color = ACTAgentTheme.colors.textSubtle, maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
    }
    ACTAgentStatusPill(text = entry.level?.uppercase() ?: "LOG", status = logLevelStatus(entry.level))
  }
}

private fun compactLogTime(value: String?): String {
  val raw = value?.trim().orEmpty()
  if (raw.isEmpty()) return "--:--"
  // Gateway log timestamps may be ISO strings or already-compact fragments;
  // keep only the HH:mm portion when present.
  val time =
    raw
      .substringAfter('T', raw)
      .substringBefore('.')
      .substringBefore('+')
      .substringBefore('Z')
  return time.takeIf { it.length >= 5 }?.take(5) ?: raw.take(5)
}

private fun logLevelStatus(level: String?): ACTAgentStatus =
  when (level?.lowercase()) {
    "error", "fatal" -> ACTAgentStatus.Danger
    "warn" -> ACTAgentStatus.Warning
    "info" -> ACTAgentStatus.Success
    else -> ACTAgentStatus.Neutral
  }
