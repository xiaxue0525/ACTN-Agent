package ai.actagent.app.ui

import ai.actagent.app.GatewaySkillSummary
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
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** Settings screen for gateway skills and their readiness state. */
@Composable
internal fun SkillsSettingsScreen(
  viewModel: MainViewModel,
  onBack: () -> Unit,
) {
  val skillsSummary by viewModel.skillsSummary.collectAsState()
  val skillsRefreshing by viewModel.skillsRefreshing.collectAsState()
  val skillsErrorText by viewModel.skillsErrorText.collectAsState()
  val isConnected by viewModel.isConnected.collectAsState()
  val skills = skillsSummary.skills
  val readyCount = skills.count { skillReady(it) }
  val needsSetupCount = skills.count { skillNeedsSetup(it) }

  LaunchedEffect(isConnected) {
    if (isConnected) {
      viewModel.refreshSkills()
    }
  }

  SettingsDetailFrame(
    title = "Skills",
    subtitle = "Installed capabilities available to ACTAgent.",
    icon = Icons.Default.Settings,
    onBack = onBack,
  ) {
    SettingsMetricPanel(
      rows =
        listOf(
          SettingsMetric("Installed", skills.size.toString()),
          SettingsMetric("Ready", readyCount.toString()),
          SettingsMetric("Needs Setup", needsSetupCount.toString()),
        ),
    )
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      ACTAgentSecondaryButton(
        text = if (skillsRefreshing) "Refreshing" else "Refresh",
        onClick = viewModel::refreshSkills,
        enabled = isConnected && !skillsRefreshing,
        modifier = Modifier.weight(1f),
      )
    }
    skillsErrorText?.let { errorText ->
      ACTAgentPanel {
        Text(text = errorText, style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.warning)
      }
    }
    when {
      !isConnected ->
        ACTAgentPanel {
          Text(text = "Connect the gateway to load skills.", style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.textMuted)
        }
      skills.isEmpty() ->
        ACTAgentPanel {
          Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(text = "No skills installed.", style = ACTAgentTheme.type.section, color = ACTAgentTheme.colors.text)
            Text(text = "Skills installed on the gateway will appear here.", style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.textMuted)
          }
        }
      else -> SkillsPanel(skills = skills)
    }
  }
}

@Composable
private fun SkillsPanel(skills: List<GatewaySkillSummary>) {
  ACTAgentListPanel(items = skills) { skill ->
    SkillListRow(skill = skill)
  }
}

@Composable
private fun SkillListRow(skill: GatewaySkillSummary) {
  actagentdetailRow(
    title = skill.name,
    subtitle = skillSubtitle(skill),
    leading = { ACTAgentTextBadge(text = skillBadge(skill)) },
    trailing = { ACTAgentStatusPill(text = skillStatusText(skill), status = skillStatus(skill)) },
  )
}

private fun skillReady(skill: GatewaySkillSummary): Boolean = !skill.disabled && skill.eligible && skill.missingCount == 0

private fun skillNeedsSetup(skill: GatewaySkillSummary): Boolean = !skill.disabled && (skill.blockedByAllowlist || !skill.eligible || skill.missingCount > 0)

private fun skillStatusText(skill: GatewaySkillSummary): String =
  when {
    skill.disabled -> "Off"
    skillNeedsSetup(skill) -> "Setup"
    else -> "Ready"
  }

private fun skillStatus(skill: GatewaySkillSummary): ACTAgentStatus =
  when {
    skill.disabled -> ACTAgentStatus.Neutral
    skillNeedsSetup(skill) -> ACTAgentStatus.Warning
    else -> ACTAgentStatus.Success
  }

private fun skillSubtitle(skill: GatewaySkillSummary): String {
  val issue =
    when {
      skill.disabled -> "Disabled"
      skill.blockedByAllowlist -> "Blocked"
      skill.missingCount > 0 -> "${skill.missingCount} missing"
      !skill.eligible -> "Needs setup"
      else -> null
    }
  return listOfNotNull(skill.description, skillSourceLabel(skill), issue).joinToString(" · ")
}

private fun skillSourceLabel(skill: GatewaySkillSummary): String =
  when (skill.source) {
    "actagent-bundled" -> if (skill.bundled) "Built-in" else "Bundled"
    "actagent-managed" -> "Installed"
    "actagent-workspace" -> "Workspace"
    "actagent-extra" -> "Extra"
    else -> "Skill"
  }

private fun skillBadge(skill: GatewaySkillSummary): String {
  skill.emoji?.let { return it }
  return skill.name
    .split(' ', '-', '_')
    .filter { it.isNotBlank() }
    .take(2)
    .mapNotNull { it.firstOrNull()?.uppercaseChar()?.toString() }
    .joinToString("")
    .ifBlank { "S" }
}
