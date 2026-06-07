package ai.actagent.app.ui

import ai.actagent.app.MainViewModel
import ai.actagent.app.VoiceCaptureMode
import ai.actagent.app.ui.design.ACTAgentPanel
import ai.actagent.app.ui.design.ACTAgentPrimaryButton
import ai.actagent.app.ui.design.ACTAgentSecondaryButton
import ai.actagent.app.ui.design.ACTAgentStatus
import ai.actagent.app.ui.design.ACTAgentStatusPill
import ai.actagent.app.ui.design.ACTAgentTheme
import ai.actagent.app.voice.VoiceConversationEntry
import ai.actagent.app.voice.VoiceConversationRole
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.PhoneDisabled
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.TextFields
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat

/** Voice home screen that routes between talk mode, dictation, and idle setup. */
@Composable
fun VoiceScreen(
  viewModel: MainViewModel,
  onOpenCommand: () -> Unit,
  onOpenGatewaySettings: () -> Unit,
  onOpenVoiceSettings: () -> Unit,
) {
  val context = LocalContext.current
  val gatewayStatus by viewModel.statusText.collectAsState()
  val voiceCaptureMode by viewModel.voiceCaptureMode.collectAsState()
  val micEnabled by viewModel.micEnabled.collectAsState()
  val micCooldown by viewModel.micCooldown.collectAsState()
  val speakerEnabled by viewModel.speakerEnabled.collectAsState()
  val micStatusText by viewModel.micStatusText.collectAsState()
  val micLiveTranscript by viewModel.micLiveTranscript.collectAsState()
  val micQueuedMessages by viewModel.micQueuedMessages.collectAsState()
  val micConversation by viewModel.micConversation.collectAsState()
  val micIsSending by viewModel.micIsSending.collectAsState()
  val talkModeEnabled by viewModel.talkModeEnabled.collectAsState()
  val talkModeListening by viewModel.talkModeListening.collectAsState()
  val talkModeSpeaking by viewModel.talkModeSpeaking.collectAsState()
  val talkModeConversation by viewModel.talkModeConversation.collectAsState()

  var pendingAction by remember { mutableStateOf<VoiceAction?>(null) }
  var hasMicPermission by remember { mutableStateOf(context.hasRecordAudioPermission()) }
  val requestMicPermission =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      hasMicPermission = granted
      if (granted) {
        when (pendingAction) {
          VoiceAction.Talk -> viewModel.setTalkModeEnabled(true)
          VoiceAction.Dictation -> viewModel.setMicEnabled(true)
          null -> Unit
        }
      }
      pendingAction = null
    }

  // Talk mode and dictation use different managers, so choose the transcript
  // from the mode the user is actually seeing.
  val activeConversation = if (voiceCaptureMode == VoiceCaptureMode.TalkMode) talkModeConversation else micConversation
  val voiceActive = micEnabled || micIsSending || talkModeEnabled
  val gatewayReady = gatewayStatus.isVoiceGatewayReady()
  val activeStatus =
    voiceStatusLabel(
      gatewayStatus = gatewayStatus,
      voiceCaptureMode = voiceCaptureMode,
      micStatusText = micStatusText,
      micQueuedMessages = micQueuedMessages.size,
      micIsSending = micIsSending,
      talkModeListening = talkModeListening,
      talkModeSpeaking = talkModeSpeaking,
    )

  if (talkModeEnabled) {
    TalkSessionScreen(
      entries = talkModeConversation,
      listening = talkModeListening,
      speaking = talkModeSpeaking,
      speakerEnabled = speakerEnabled,
      onToggleSpeaker = { viewModel.setSpeakerEnabled(!speakerEnabled) },
      onEndTalk = { viewModel.setTalkModeEnabled(false) },
      onOpenVoiceSettings = onOpenVoiceSettings,
    )
    return
  }

  if (voiceCaptureMode == VoiceCaptureMode.ManualMic || micEnabled || micIsSending) {
    // Manual mic mode owns the whole screen while a turn is being captured or
    // delivered, even after the user releases the mic.
    DictationScreen(
      liveTranscript = micLiveTranscript,
      conversation = micConversation,
      listening = micEnabled,
      sending = micIsSending,
      statusText = activeStatus,
      gatewayStatus = gatewayStatus,
      onCancel = { viewModel.cancelMicCapture() },
      onSend = { viewModel.setMicEnabled(false) },
      onOpenVoiceSettings = onOpenVoiceSettings,
    )
    return
  }

  Column(
    modifier =
      Modifier
        .fillMaxSize()
        .imePadding()
        .padding(horizontal = 20.dp, vertical = 8.dp),
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    VoiceHeader(
      statusText = if (voiceActive || !gatewayReady) activeStatus else "Your voice command center.",
      speakerEnabled = speakerEnabled,
      onToggleSpeaker = { viewModel.setSpeakerEnabled(!speakerEnabled) },
      onOpenCommand = onOpenCommand,
    )

    VoiceHero(
      gatewayStatus = gatewayStatus,
      voiceCaptureMode = voiceCaptureMode,
      micEnabled = micEnabled,
      talkModeEnabled = talkModeEnabled,
      talkModeListening = talkModeListening,
      talkModeSpeaking = talkModeSpeaking,
      micLiveTranscript = micLiveTranscript,
      gatewayReady = gatewayReady,
      onStartTalk = {
        runVoiceAction(
          action = VoiceAction.Talk,
          hasMicPermission = hasMicPermission,
          requestPermission = {
            pendingAction = VoiceAction.Talk
            requestMicPermission.launch(Manifest.permission.RECORD_AUDIO)
          },
          run = { viewModel.setTalkModeEnabled(!talkModeEnabled) },
        )
      },
      onStartDictation = {
        if (micCooldown) return@VoiceHero
        runVoiceAction(
          action = VoiceAction.Dictation,
          hasMicPermission = hasMicPermission,
          requestPermission = {
            pendingAction = VoiceAction.Dictation
            requestMicPermission.launch(Manifest.permission.RECORD_AUDIO)
          },
          run = { viewModel.setMicEnabled(!micEnabled) },
        )
      },
      onConnectGateway = onOpenGatewaySettings,
    )

    if (!hasMicPermission) {
      VoicePermissionPanel(
        onRequestPermission = {
          pendingAction = VoiceAction.Talk
          requestMicPermission.launch(Manifest.permission.RECORD_AUDIO)
        },
      )
    }

    VoiceTranscript(
      entries = activeConversation,
      showThinking = micIsSending && activeConversation.none { it.role == VoiceConversationRole.Assistant && it.isStreaming },
      modifier = Modifier.weight(1f),
    )
  }
}

/** Full-screen dictation capture and send state. */
@Composable
private fun DictationScreen(
  liveTranscript: String?,
  conversation: List<VoiceConversationEntry>,
  listening: Boolean,
  sending: Boolean,
  statusText: String,
  gatewayStatus: String,
  onCancel: () -> Unit,
  onSend: () -> Unit,
  onOpenVoiceSettings: () -> Unit,
) {
  val lastUserText = conversation.lastOrNull { it.role == VoiceConversationRole.User }?.text
  val draftText = liveTranscript?.takeIf { it.isNotBlank() } ?: lastUserText.orEmpty()
  val speechProviderReady = gatewayStatus.isVoiceGatewayReady()
  Column(
    modifier =
      Modifier
        .fillMaxSize()
        .imePadding()
        .padding(horizontal = 20.dp, vertical = 8.dp),
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
      VoicePlainIconButton(icon = Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back to voice", onClick = onCancel)
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(text = "Dictation", style = ACTAgentTheme.type.title.copy(fontSize = 16.sp, lineHeight = 20.sp), color = ACTAgentTheme.colors.text)
        Text(text = "Transcribe then send", style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.textMuted)
      }
      VoicePlainIconButton(icon = Icons.Default.Settings, contentDescription = "Dictation settings", onClick = onOpenVoiceSettings)
    }

    Surface(
      modifier = Modifier.fillMaxWidth().aspectRatio(0.82f),
      shape = RoundedCornerShape(ACTAgentTheme.radii.panel),
      color = ACTAgentTheme.colors.canvas,
      border = BorderStroke(1.dp, ACTAgentTheme.colors.borderStrong),
    ) {
      Column(modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 12.dp), verticalArrangement = Arrangement.SpaceBetween) {
        Text(
          text = draftText.ifBlank { if (sending) "Sending to chat..." else "Start speaking..." },
          style = ACTAgentTheme.type.title.copy(fontSize = 15.sp, lineHeight = 19.sp),
          color = if (draftText.isBlank()) ACTAgentTheme.colors.textSubtle else ACTAgentTheme.colors.text,
          maxLines = 7,
          overflow = TextOverflow.Ellipsis,
        )
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
          DictationWaveform(active = listening || sending)
          Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(imageVector = Icons.Default.Mic, contentDescription = null, modifier = Modifier.size(15.dp), tint = if (listening) ACTAgentTheme.colors.success else ACTAgentTheme.colors.textMuted)
            Text(text = statusText, style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.textMuted)
          }
        }
      }
    }

    ACTAgentPanel(contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)) {
      Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Surface(
          modifier = Modifier.size(30.dp),
          shape = CircleShape,
          color = ACTAgentTheme.colors.surfacePressed,
          border = BorderStroke(1.dp, ACTAgentTheme.colors.border),
        ) {
          Box(contentAlignment = Alignment.Center) {
            Icon(imageVector = Icons.Default.GraphicEq, contentDescription = null, modifier = Modifier.size(16.dp), tint = ACTAgentTheme.colors.text)
          }
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text(text = "Speech provider", style = ACTAgentTheme.type.section, color = ACTAgentTheme.colors.text)
          Text(text = gatewayStatus.voiceGatewayLabel(), style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          Text(
            text =
              when {
                sending -> "Sending"
                speechProviderReady -> "Ready"
                else -> "Offline"
              },
            style = ACTAgentTheme.type.caption.copy(fontSize = 12.5.sp, lineHeight = 16.sp),
            color =
              when {
                sending -> ACTAgentTheme.colors.warning
                speechProviderReady -> ACTAgentTheme.colors.success
                else -> ACTAgentTheme.colors.textMuted
              },
          )
          Box(
            modifier =
              Modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(
                  when {
                    sending -> ACTAgentTheme.colors.warning
                    speechProviderReady -> ACTAgentTheme.colors.success
                    else -> ACTAgentTheme.colors.textSubtle
                  },
                ),
          )
        }
      }
    }

    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
      Icon(imageVector = Icons.Default.Info, contentDescription = null, modifier = Modifier.size(16.dp), tint = ACTAgentTheme.colors.textMuted)
      Text(text = "Tip: stop listening to send the captured turn.", style = ACTAgentTheme.type.caption, color = ACTAgentTheme.colors.textMuted)
    }

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
      ACTAgentSecondaryButton(text = "Cancel", icon = Icons.Default.Close, onClick = onCancel, modifier = Modifier.weight(0.95f))
      ACTAgentPrimaryButton(text = if (sending) "Sending" else "Send to Chat", icon = Icons.AutoMirrored.Filled.Send, onClick = onSend, enabled = !sending, modifier = Modifier.weight(1.25f))
    }
  }
}

@Composable
private fun DictationWaveform(active: Boolean) {
  Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
    List(48) { index ->
      val height = if (active) 3 + ((index * 7) % 16) else 3 + (index % 3) * 2
      Box(
        modifier =
          Modifier
            .size(width = 2.dp, height = height.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(if (active) ACTAgentTheme.colors.text else ACTAgentTheme.colors.textSubtle),
      )
    }
  }
}

@Composable
private fun TalkSessionScreen(
  entries: List<VoiceConversationEntry>,
  listening: Boolean,
  speaking: Boolean,
  speakerEnabled: Boolean,
  onToggleSpeaker: () -> Unit,
  onEndTalk: () -> Unit,
  onOpenVoiceSettings: () -> Unit,
) {
  Column(
    modifier =
      Modifier
        .fillMaxSize()
        .imePadding()
        .padding(horizontal = 20.dp, vertical = 8.dp),
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      VoicePlainIconButton(icon = Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back to voice", onClick = onEndTalk)
      Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(text = "Realtime Talk", style = ACTAgentTheme.type.title.copy(fontSize = 16.sp, lineHeight = 20.sp), color = ACTAgentTheme.colors.text)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
          Box(modifier = Modifier.size(4.5.dp).clip(CircleShape).background(if (speaking || listening) ACTAgentTheme.colors.success else ACTAgentTheme.colors.textSubtle))
          Text(
            text =
              if (speaking) {
                "ACTAgent speaking"
              } else if (listening) {
                "Realtime voice"
              } else {
                "Connected"
              },
            style = ACTAgentTheme.type.body,
            color = ACTAgentTheme.colors.textMuted,
          )
        }
      }
      VoicePlainIconButton(icon = Icons.Default.Info, contentDescription = "Talk settings", onClick = onOpenVoiceSettings)
    }

    Surface(
      modifier = Modifier.fillMaxWidth().height(52.dp),
      shape = RoundedCornerShape(ACTAgentTheme.radii.panel),
      color = ACTAgentTheme.colors.canvas,
      border = BorderStroke(1.dp, ACTAgentTheme.colors.borderStrong),
    ) {
      Box(contentAlignment = Alignment.Center) {
        TalkWaveform(active = listening || speaking)
      }
    }

    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Text(text = "Live transcript", style = ACTAgentTheme.type.caption, color = ACTAgentTheme.colors.textMuted)
      TalkTranscript(entries = entries, modifier = Modifier.weight(1f))
    }

    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceEvenly,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      TalkControl(icon = if (speakerEnabled) Icons.AutoMirrored.Filled.VolumeUp else Icons.AutoMirrored.Filled.VolumeOff, label = if (speakerEnabled) "Mute" else "Unmute", onClick = onToggleSpeaker)
      TalkControl(icon = Icons.Default.PhoneDisabled, label = "End", primary = true, onClick = onEndTalk)
      TalkControl(icon = Icons.Default.GraphicEq, label = "Voice", onClick = onOpenVoiceSettings)
    }
  }
}

@Composable
private fun TalkTranscript(
  entries: List<VoiceConversationEntry>,
  modifier: Modifier = Modifier,
) {
  LazyColumn(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    if (entries.isEmpty()) {
      item {
        TalkTranscriptCard(label = "ACTAgent", text = "Listening for your next turn.", muted = true)
      }
    } else {
      items(entries.takeLast(6), key = { it.id }) { entry ->
        TalkTranscriptCard(
          label = if (entry.role == VoiceConversationRole.User) "You" else "ACTAgent",
          text = if (entry.isStreaming && entry.text.isBlank()) "Listening response..." else entry.text,
          muted = entry.isStreaming,
        )
      }
    }
  }
}

@Composable
private fun TalkTranscriptCard(
  label: String,
  text: String,
  muted: Boolean = false,
) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(ACTAgentTheme.radii.panel),
    color = ACTAgentTheme.colors.surface,
    border = BorderStroke(1.dp, ACTAgentTheme.colors.border),
  ) {
    Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
      Text(text = label, style = ACTAgentTheme.type.section, color = ACTAgentTheme.colors.text)
      Text(text = text, style = ACTAgentTheme.type.body, color = if (muted) ACTAgentTheme.colors.textMuted else ACTAgentTheme.colors.text)
    }
  }
}

@Composable
private fun TalkControl(
  icon: androidx.compose.ui.graphics.vector.ImageVector,
  label: String,
  primary: Boolean = false,
  onClick: () -> Unit,
) {
  Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
    Surface(
      onClick = onClick,
      modifier = Modifier.size(ACTAgentTheme.spacing.touchTarget),
      shape = RoundedCornerShape(ACTAgentTheme.radii.button),
      color = if (primary) ACTAgentTheme.colors.primary else ACTAgentTheme.colors.canvas,
      contentColor = if (primary) ACTAgentTheme.colors.primaryText else ACTAgentTheme.colors.text,
      border = BorderStroke(1.dp, if (primary) ACTAgentTheme.colors.primary else ACTAgentTheme.colors.border),
    ) {
      Box(contentAlignment = Alignment.Center) {
        Icon(imageVector = icon, contentDescription = label, modifier = Modifier.size(if (primary) 20.dp else 18.dp))
      }
    }
    Text(text = label, style = ACTAgentTheme.type.caption.copy(fontSize = 12.5.sp, lineHeight = 16.sp), color = ACTAgentTheme.colors.textMuted)
  }
}

@Composable
private fun TalkWaveform(active: Boolean) {
  Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
    listOf(4, 12, 24, 34, 46, 28, 12, 38, 44, 24, 12, 30, 42, 18, 6).forEachIndexed { index, height ->
      Box(
        modifier =
          Modifier
            .size(width = 3.dp, height = (if (active) height else 6 + index % 4 * 5).dp)
            .clip(RoundedCornerShape(999.dp))
            .background(if (active) ACTAgentTheme.colors.text else ACTAgentTheme.colors.textSubtle),
      )
    }
  }
}

@Composable
private fun VoiceHeader(
  statusText: String,
  speakerEnabled: Boolean,
  onToggleSpeaker: () -> Unit,
  onOpenCommand: () -> Unit,
) {
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Text(
        text = "O P E N C L A W",
        style = ACTAgentTheme.type.title.copy(fontSize = 18.sp, lineHeight = 23.sp),
        color = ACTAgentTheme.colors.text,
        modifier = Modifier.weight(1f),
      )
      VoicePlainIconButton(icon = Icons.Default.Search, contentDescription = "Search voice", onClick = onOpenCommand)
      VoiceAvatar(text = "OC")
    }
    Row(
      modifier = Modifier.fillMaxWidth(),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(text = "Voice", style = ACTAgentTheme.type.display.copy(fontSize = 16.sp, lineHeight = 20.sp), color = ACTAgentTheme.colors.text)
        Text(
          text = statusText,
          style = ACTAgentTheme.type.body,
          color = ACTAgentTheme.colors.textMuted,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
      }
      VoicePlainIconButton(
        icon = if (speakerEnabled) Icons.AutoMirrored.Filled.VolumeUp else Icons.AutoMirrored.Filled.VolumeOff,
        contentDescription = if (speakerEnabled) "Mute speaker" else "Unmute speaker",
        onClick = onToggleSpeaker,
      )
    }
  }
}

@Composable
private fun VoiceAvatar(text: String) {
  Surface(
    modifier = Modifier.size(34.dp),
    shape = CircleShape,
    color = ACTAgentTheme.colors.surfaceRaised,
    contentColor = ACTAgentTheme.colors.text,
    border = BorderStroke(1.dp, ACTAgentTheme.colors.border),
  ) {
    Box(contentAlignment = Alignment.Center) {
      Text(text = text.take(2).uppercase(), style = ACTAgentTheme.type.label)
    }
  }
}

@Composable
private fun VoicePlainIconButton(
  icon: androidx.compose.ui.graphics.vector.ImageVector,
  contentDescription: String,
  onClick: () -> Unit,
) {
  Surface(onClick = onClick, modifier = Modifier.size(ACTAgentTheme.spacing.touchTarget), shape = CircleShape, color = Color.Transparent, contentColor = ACTAgentTheme.colors.text) {
    Box(contentAlignment = Alignment.Center) {
      Icon(imageVector = icon, contentDescription = contentDescription, modifier = Modifier.size(18.dp))
    }
  }
}

@Composable
private fun VoiceHero(
  gatewayStatus: String,
  voiceCaptureMode: VoiceCaptureMode,
  micEnabled: Boolean,
  talkModeEnabled: Boolean,
  talkModeListening: Boolean,
  talkModeSpeaking: Boolean,
  micLiveTranscript: String?,
  gatewayReady: Boolean,
  onStartTalk: () -> Unit,
  onStartDictation: () -> Unit,
  onConnectGateway: () -> Unit,
) {
  Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(9.dp)) {
    VoiceOrb(
      active = micEnabled || talkModeEnabled,
      listening = talkModeListening || voiceCaptureMode == VoiceCaptureMode.ManualMic,
      speaking = talkModeSpeaking,
    )

    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      Box(
        modifier =
          Modifier
            .size(7.dp)
            .clip(CircleShape)
            .background(if (micEnabled || talkModeEnabled) ACTAgentTheme.colors.success else ACTAgentTheme.colors.textSubtle),
      )
      Text(
        text =
          when {
            talkModeSpeaking -> "ACTAgent is replying"
            talkModeListening -> "Listening"
            talkModeEnabled -> "Talk is live"
            micEnabled -> "Dictation is listening"
            !gatewayReady -> "Gateway offline"
            else -> "Ready to talk"
          },
        style = ACTAgentTheme.type.body,
        color = ACTAgentTheme.colors.textMuted,
        textAlign = TextAlign.Center,
      )
    }

    if (!micLiveTranscript.isNullOrBlank()) {
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(ACTAgentTheme.radii.panel),
        color = ACTAgentTheme.colors.surface,
        border = BorderStroke(1.dp, ACTAgentTheme.colors.borderStrong),
      ) {
        Text(
          text = micLiveTranscript.trim(),
          modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
          style = ACTAgentTheme.type.body,
          color = ACTAgentTheme.colors.text,
        )
      }
    }

    ACTAgentPanel(contentPadding = PaddingValues(horizontal = 14.dp, vertical = 4.dp)) {
      VoiceModeRow(
        title = if (talkModeEnabled) "End Talk" else "Realtime Talk",
        subtitle =
          when {
            talkModeEnabled -> "Conversation is live"
            gatewayReady -> "Natural conversation in real time"
            else -> "Connect gateway to start"
          },
        icon = if (talkModeEnabled) Icons.Default.PhoneDisabled else Icons.Default.RecordVoiceOver,
        onClick = onStartTalk,
        enabled = gatewayReady || talkModeEnabled,
      )
      VoiceModeRow(
        title = if (micEnabled) "Stop Dictation" else "Dictation",
        subtitle =
          when {
            micEnabled -> "Listening for one turn"
            gatewayReady -> "Convert speech to text"
            else -> "Connect gateway to start"
          },
        icon = if (micEnabled) Icons.Default.MicOff else Icons.Default.TextFields,
        onClick = onStartDictation,
        enabled = gatewayReady || micEnabled,
      )
    }

    VoiceProviderCard(gatewayStatus = gatewayStatus)

    VoicePrimaryAction(
      text =
        when {
          talkModeEnabled -> "End Talk"
          gatewayReady -> "Start Talk"
          else -> "Connect Gateway"
        },
      icon =
        when {
          talkModeEnabled -> Icons.Default.PhoneDisabled
          gatewayReady -> Icons.Default.Phone
          else -> Icons.Default.Cloud
        },
      onClick = if (gatewayReady || talkModeEnabled) onStartTalk else onConnectGateway,
    )
  }
}

@Composable
private fun VoiceModeRow(
  title: String,
  subtitle: String,
  icon: androidx.compose.ui.graphics.vector.ImageVector,
  onClick: () -> Unit,
  enabled: Boolean = true,
) {
  Surface(onClick = onClick, enabled = enabled, color = Color.Transparent, contentColor = ACTAgentTheme.colors.text) {
    Row(
      modifier = Modifier.fillMaxWidth().heightIn(min = 54.dp).padding(horizontal = 0.dp, vertical = 7.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Surface(
        modifier = Modifier.size(30.dp),
        shape = RoundedCornerShape(ACTAgentTheme.radii.control),
        color = if (enabled) ACTAgentTheme.colors.surface else ACTAgentTheme.colors.canvas,
        contentColor = if (enabled) ACTAgentTheme.colors.text else ACTAgentTheme.colors.textSubtle,
        border = BorderStroke(1.dp, ACTAgentTheme.colors.border),
      ) {
        Box(contentAlignment = Alignment.Center) {
          Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(15.dp))
        }
      }
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(text = title, style = ACTAgentTheme.type.body, color = if (enabled) ACTAgentTheme.colors.text else ACTAgentTheme.colors.textMuted, maxLines = 1)
        Text(text = subtitle, style = ACTAgentTheme.type.caption.copy(fontSize = 12.5.sp, lineHeight = 16.sp), color = ACTAgentTheme.colors.textMuted, maxLines = 1)
      }
      if (enabled) {
        Icon(
          imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
          contentDescription = null,
          modifier = Modifier.size(18.dp),
          tint = ACTAgentTheme.colors.textMuted,
        )
      }
    }
  }
}

@Composable
private fun VoiceProviderCard(gatewayStatus: String) {
  val ready = gatewayStatus.isVoiceGatewayReady()
  Surface(
    modifier = Modifier.fillMaxWidth().heightIn(min = 58.dp),
    shape = RoundedCornerShape(ACTAgentTheme.radii.panel),
    color = ACTAgentTheme.colors.surface,
    contentColor = ACTAgentTheme.colors.text,
    border = BorderStroke(1.dp, ACTAgentTheme.colors.border),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 9.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Surface(
        modifier = Modifier.size(30.dp),
        shape = RoundedCornerShape(ACTAgentTheme.radii.control),
        color = ACTAgentTheme.colors.canvas,
        contentColor = ACTAgentTheme.colors.text,
        border = BorderStroke(1.dp, ACTAgentTheme.colors.borderStrong),
      ) {
        Box(contentAlignment = Alignment.Center) {
          Icon(imageVector = Icons.Default.GraphicEq, contentDescription = null, modifier = Modifier.size(15.dp))
        }
      }
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(text = "Provider", style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.text, maxLines = 1)
        Text(text = gatewayStatus.voiceGatewayLabel(), style = ACTAgentTheme.type.caption, color = ACTAgentTheme.colors.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        Box(
          modifier =
            Modifier
              .size(7.dp)
              .clip(CircleShape)
              .background(if (ready) ACTAgentTheme.colors.success else ACTAgentTheme.colors.textSubtle),
        )
        Text(text = if (ready) "Ready" else "Offline", style = ACTAgentTheme.type.caption, color = ACTAgentTheme.colors.textMuted, maxLines = 1)
      }
    }
  }
}

@Composable
private fun VoicePrimaryAction(
  text: String,
  icon: androidx.compose.ui.graphics.vector.ImageVector,
  onClick: () -> Unit,
) {
  Surface(
    onClick = onClick,
    modifier = Modifier.fillMaxWidth().height(ACTAgentTheme.spacing.touchTarget),
    shape = RoundedCornerShape(ACTAgentTheme.radii.button),
    color = ACTAgentTheme.colors.primary,
    contentColor = ACTAgentTheme.colors.primaryText,
  ) {
    Row(
      modifier = Modifier.fillMaxSize(),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.Center,
    ) {
      Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(17.dp))
      Text(text = text, modifier = Modifier.padding(start = 8.dp), style = ACTAgentTheme.type.label)
    }
  }
}

@Composable
private fun VoiceOrb(
  active: Boolean,
  listening: Boolean,
  speaking: Boolean,
) {
  Surface(
    modifier = Modifier.size(112.dp),
    shape = CircleShape,
    color = if (active) ACTAgentTheme.colors.surfacePressed else ACTAgentTheme.colors.surface,
    border = BorderStroke(1.dp, if (active) ACTAgentTheme.colors.borderStrong else ACTAgentTheme.colors.border),
  ) {
    Box(contentAlignment = Alignment.Center) {
      Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(
          imageVector =
            when {
              speaking -> Icons.Default.RecordVoiceOver
              listening -> Icons.Default.GraphicEq
              else -> Icons.Default.Mic
            },
          contentDescription = null,
          modifier = Modifier.size(32.dp),
          tint = ACTAgentTheme.colors.text,
        )
        Waveform(active = active)
      }
    }
  }
}

@Composable
private fun Waveform(active: Boolean) {
  Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
    listOf(6, 11, 17, 23, 14, 9, 20, 14, 7).forEachIndexed { index, height ->
      Box(
        modifier =
          Modifier
            .size(width = 2.dp, height = (if (active) height else 6 + index % 3 * 3).dp)
            .clip(RoundedCornerShape(999.dp))
            .background(if (active) ACTAgentTheme.colors.text else ACTAgentTheme.colors.textSubtle),
      )
    }
  }
}

@Composable
private fun VoiceTranscript(
  entries: List<VoiceConversationEntry>,
  showThinking: Boolean,
  modifier: Modifier = Modifier,
) {
  val listState = rememberLazyListState()
  LaunchedEffect(entries.size, showThinking) {
    if (entries.isNotEmpty() || showThinking) {
      listState.animateScrollToItem(0)
    }
  }

  LazyColumn(
    modifier = modifier.fillMaxWidth(),
    state = listState,
    reverseLayout = true,
    verticalArrangement = Arrangement.spacedBy(10.dp),
    contentPadding = PaddingValues(bottom = 8.dp),
  ) {
    if (showThinking) {
      item(key = "thinking") {
        VoiceThinkingCard()
      }
    }

    items(entries.asReversed(), key = { it.id }) { entry ->
      VoiceTurnCard(entry = entry)
    }

    if (entries.isEmpty() && !showThinking) {
      item {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
          Text(text = "Live transcript", style = ACTAgentTheme.type.caption, color = ACTAgentTheme.colors.textSubtle)
          ACTAgentPanel(contentPadding = PaddingValues(horizontal = 14.dp, vertical = 9.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
              Text(text = "No transcript yet", style = ACTAgentTheme.type.section, color = ACTAgentTheme.colors.text)
              Text(
                text = "Your words and ACTAgent replies will appear here.",
                style = ACTAgentTheme.type.body,
                color = ACTAgentTheme.colors.textMuted,
              )
            }
          }
        }
      }
    }
  }
}

@Composable
private fun VoiceTurnCard(entry: VoiceConversationEntry) {
  val isUser = entry.role == VoiceConversationRole.User
  Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start) {
    Surface(
      modifier = Modifier.fillMaxWidth(if (isUser) 0.82f else 0.92f),
      shape = RoundedCornerShape(ACTAgentTheme.radii.panel),
      color = if (isUser) ACTAgentTheme.colors.surfacePressed else ACTAgentTheme.colors.surfaceRaised,
      contentColor = ACTAgentTheme.colors.text,
      border = BorderStroke(1.dp, if (entry.isStreaming) ACTAgentTheme.colors.borderStrong else ACTAgentTheme.colors.border),
    ) {
      Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(
          text = if (isUser) "You" else "ACTAgent",
          style = ACTAgentTheme.type.caption.copy(fontSize = 12.5.sp, lineHeight = 16.sp, fontWeight = FontWeight.SemiBold),
          color = ACTAgentTheme.colors.textSubtle,
        )
        Text(
          text = if (entry.isStreaming && entry.text.isBlank()) "Listening..." else entry.text,
          style = ACTAgentTheme.type.body,
          color = ACTAgentTheme.colors.text,
        )
      }
    }
  }
}

@Composable
private fun VoiceThinkingCard() {
  ACTAgentPanel {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
      ACTAgentStatusPill(text = "Sending", status = ACTAgentStatus.Warning)
      Text(text = "ACTAgent is preparing a response.", style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.textMuted)
    }
  }
}

@Composable
private fun VoicePermissionPanel(onRequestPermission: () -> Unit) {
  ACTAgentPanel {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
      ACTAgentStatusPill(text = "Permission needed", status = ACTAgentStatus.Warning)
      Text(text = "Microphone access is needed.", style = ACTAgentTheme.type.section, color = ACTAgentTheme.colors.text)
      Text(
        text = "ACTAgent only listens when you start Talk or Dictation.",
        style = ACTAgentTheme.type.body,
        color = ACTAgentTheme.colors.textMuted,
      )
      ACTAgentSecondaryButton(text = "Enable Microphone", icon = Icons.Default.Mic, onClick = onRequestPermission)
    }
  }
}

private enum class VoiceAction {
  Talk,
  Dictation,
}

private fun runVoiceAction(
  action: VoiceAction,
  hasMicPermission: Boolean,
  requestPermission: () -> Unit,
  run: () -> Unit,
) {
  if (hasMicPermission) {
    run()
  } else {
    requestPermission()
  }
}

private fun voiceStatusLabel(
  gatewayStatus: String,
  voiceCaptureMode: VoiceCaptureMode,
  micStatusText: String,
  micQueuedMessages: Int,
  micIsSending: Boolean,
  talkModeListening: Boolean,
  talkModeSpeaking: Boolean,
): String =
  when {
    voiceCaptureMode == VoiceCaptureMode.TalkMode && talkModeSpeaking -> "ACTAgent is speaking"
    voiceCaptureMode == VoiceCaptureMode.TalkMode && talkModeListening -> "Listening"
    voiceCaptureMode == VoiceCaptureMode.TalkMode -> "Talk is live"
    micIsSending -> "Sending dictation"
    voiceCaptureMode == VoiceCaptureMode.ManualMic -> micStatusText.ifBlank { "Listening" }
    micQueuedMessages > 0 -> "$micQueuedMessages queued"
    !gatewayStatus.isVoiceGatewayReady() -> "Gateway offline"
    else -> "Ready to talk"
  }

private fun String.isVoiceGatewayReady(): Boolean {
  val status = lowercase()
  return !status.contains("offline") && !status.contains("not connected") && !status.contains("failed") && !status.contains("error")
}

private fun String.voiceGatewayLabel(): String = if (isVoiceGatewayReady()) "Connected and ready" else "Gateway not connected"

private fun Context.hasRecordAudioPermission(): Boolean = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
