package ai.actagent.app.ui

import ai.actagent.app.MainViewModel
import ai.actagent.app.ui.design.ACTAgentPanel
import ai.actagent.app.ui.design.ACTAgentPrimaryButton
import ai.actagent.app.ui.design.ACTAgentSecondaryButton
import ai.actagent.app.ui.design.ACTAgentTheme
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ScreenShare
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

/** Settings detail surface for live canvas status, refresh, and embedded preview. */
@Composable
internal fun CanvasSettingsScreen(
  viewModel: MainViewModel,
  onBack: () -> Unit,
) {
  val isConnected by viewModel.isConnected.collectAsState()
  val currentUrl by viewModel.canvasCurrentUrl.collectAsState()
  val hydrated by viewModel.canvasA2uiHydrated.collectAsState()
  val rehydratePending by viewModel.canvasRehydratePending.collectAsState()
  val rehydrateErrorText by viewModel.canvasRehydrateErrorText.collectAsState()
  val hasLivePage = currentUrl?.isNotBlank() == true
  val showCanvasSurface = isConnected
  val canvasLabel = if (hasLivePage) "Live page" else "Home canvas"

  LaunchedEffect(isConnected) {
    if (isConnected) {
      // Refresh once when the gateway comes online so the settings preview is
      // populated before the user manually asks for a rehydrate.
      viewModel.refreshHomeCanvasOverviewIfConnected()
    }
  }

  SettingsDetailFrame(
    title = "Canvas",
    subtitle = "Current screen output and interactive app surface.",
    icon = Icons.AutoMirrored.Filled.ScreenShare,
    onBack = onBack,
  ) {
    SettingsMetricPanel(
      rows =
        listOf(
          SettingsMetric("Connection", if (isConnected) "Online" else "Offline"),
          SettingsMetric("Surface", canvasLabel),
          SettingsMetric("Bridge", if (hasLivePage && hydrated) "Ready" else "Standby"),
        ),
    )
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      ACTAgentPrimaryButton(
        text = if (rehydratePending) "Refreshing" else "Refresh Screen",
        onClick = { viewModel.requestCanvasRehydrate(source = "settings_canvas") },
        enabled = isConnected && !rehydratePending,
        modifier = Modifier.weight(1f),
      )
      ACTAgentSecondaryButton(
        text = "Reconnect",
        onClick = viewModel::refreshGatewayConnection,
        modifier = Modifier.weight(1f),
      )
    }
    rehydrateErrorText?.let {
      ACTAgentPanel {
        Text(text = it, style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.warning)
      }
    }
    ACTAgentPanel(contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp)) {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(text = canvasLabel, style = ACTAgentTheme.type.section, color = ACTAgentTheme.colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Surface(
          modifier = Modifier.fillMaxWidth().height(520.dp).clip(RoundedCornerShape(ACTAgentTheme.radii.panel)),
          shape = RoundedCornerShape(ACTAgentTheme.radii.panel),
          color = ACTAgentTheme.colors.canvas,
          border = BorderStroke(1.dp, ACTAgentTheme.colors.border),
        ) {
          Box {
            if (showCanvasSurface) {
              CanvasScreen(viewModel = viewModel, visible = true, modifier = Modifier.fillMaxWidth().height(520.dp))
            } else {
              CanvasStandbyPanel(isConnected = isConnected)
            }
          }
        }
      }
    }
  }
}

@Composable
private fun CanvasStandbyPanel(isConnected: Boolean) {
  Column(
    modifier = Modifier.fillMaxWidth().height(520.dp).padding(horizontal = 24.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center,
  ) {
    Surface(
      modifier = Modifier.size(54.dp),
      shape = RoundedCornerShape(ACTAgentTheme.radii.panel),
      color = ACTAgentTheme.colors.surfacePressed,
      border = BorderStroke(1.dp, ACTAgentTheme.colors.borderStrong),
      contentColor = ACTAgentTheme.colors.text,
    ) {
      Box(contentAlignment = Alignment.Center) {
        Icon(imageVector = Icons.AutoMirrored.Filled.ScreenShare, contentDescription = null, modifier = Modifier.size(26.dp))
      }
    }
    Text(
      text = if (isConnected) "Screen surface ready" else "Connect the gateway",
      style = ACTAgentTheme.type.title,
      color = ACTAgentTheme.colors.text,
      modifier = Modifier.padding(top = 18.dp),
    )
    Text(
      text = if (isConnected) "Canvas output appears here when ACTAgent opens an app surface." else "Canvas output needs an active gateway connection.",
      style = ACTAgentTheme.type.body,
      color = ACTAgentTheme.colors.textMuted,
      modifier = Modifier.padding(top = 6.dp),
    )
  }
}
