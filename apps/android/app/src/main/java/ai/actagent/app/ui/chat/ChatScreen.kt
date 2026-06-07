package ai.actagent.app.ui.chat

import ai.actagent.app.MainViewModel
import ai.actagent.app.chat.ChatMessage
import ai.actagent.app.chat.ChatMessageContent
import ai.actagent.app.chat.ChatPendingToolCall
import ai.actagent.app.chat.ChatSessionEntry
import ai.actagent.app.chat.OutgoingAttachment
import ai.actagent.app.ui.design.ACTAgentListItem
import ai.actagent.app.ui.design.ACTAgentLoadingState
import ai.actagent.app.ui.design.ACTAgentPanel
import ai.actagent.app.ui.design.ACTAgentStatus
import ai.actagent.app.ui.design.ACTAgentStatusPill
import ai.actagent.app.ui.design.ACTAgentTheme
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.DateFormat
import java.util.Date
import java.util.Locale

/** Full chat surface that wires MainViewModel state to messages, attachments, voice, and composer actions. */
@Composable
fun ChatScreen(
  viewModel: MainViewModel,
  onVoice: () -> Unit,
  onOpenSessions: () -> Unit,
) {
  val messages by viewModel.chatMessages.collectAsState()
  val historyLoading by viewModel.chatHistoryLoading.collectAsState()
  val errorText by viewModel.chatError.collectAsState()
  val pendingRunCount by viewModel.pendingRunCount.collectAsState()
  val healthOk by viewModel.chatHealthOk.collectAsState()
  val sessionKey by viewModel.chatSessionKey.collectAsState()
  val mainSessionKey by viewModel.mainSessionKey.collectAsState()
  val thinkingLevel by viewModel.chatThinkingLevel.collectAsState()
  val streamingAssistantText by viewModel.chatStreamingAssistantText.collectAsState()
  val pendingToolCalls by viewModel.chatPendingToolCalls.collectAsState()
  val sessions by viewModel.chatSessions.collectAsState()
  val chatDraft by viewModel.chatDraft.collectAsState()
  val pendingAssistantAutoSend by viewModel.pendingAssistantAutoSend.collectAsState()
  val context = LocalContext.current
  val resolver = context.contentResolver
  val scope = rememberCoroutineScope()
  val attachments = remember { mutableStateListOf<PendingImageAttachment>() }
  val pickImages =
    rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
      if (uris.isNullOrEmpty()) return@rememberLauncherForActivityResult
      scope.launch(Dispatchers.IO) {
        val next =
          uris.take(8).mapNotNull { uri ->
            try {
              loadSizedImageAttachment(resolver, uri)
            } catch (_: Throwable) {
              null
            }
          }
        withContext(Dispatchers.Main) {
          attachments.addAll(next)
        }
      }
    }

  LaunchedEffect(Unit) {
    val loadSessionKey = resolveInitialChatLoadSessionKey(sessionKey, mainSessionKey)
    if (loadSessionKey != null) {
      viewModel.loadChat(loadSessionKey)
    }
    viewModel.refreshChatSessions(limit = 100)
  }

  LaunchedEffect(pendingAssistantAutoSend, healthOk, pendingRunCount, thinkingLevel) {
    val accepted =
      dispatchPendingAssistantAutoSend(
        pendingPrompt = pendingAssistantAutoSend,
        healthOk = healthOk,
        pendingRunCount = pendingRunCount,
      ) { prompt ->
        viewModel.sendChatAwaitAcceptance(message = prompt, thinking = thinkingLevel, attachments = emptyList())
      }
    if (accepted) {
      viewModel.clearPendingAssistantAutoSend()
    }
  }

  var input by rememberSaveable { mutableStateOf("") }

  LaunchedEffect(chatDraft) {
    val draft = chatDraft?.trim()?.ifEmpty { null } ?: return@LaunchedEffect
    input = draft
    viewModel.clearChatDraft()
  }

  Column(
    modifier =
      Modifier
        .fillMaxSize()
        .padding(horizontal = 18.dp, vertical = 6.dp),
    verticalArrangement = Arrangement.spacedBy(5.dp),
  ) {
    ChatHeader(
      sessionTitle = currentSessionTitle(sessionKey = sessionKey, sessions = sessions),
      thinkingLevel = thinkingLevel,
      healthOk = healthOk,
      pendingRunCount = pendingRunCount,
      onMore = {
        viewModel.refreshChat()
        viewModel.refreshChatSessions(limit = 100)
      },
    )

    ChatSessionSwitcher(
      sessionKey = sessionKey,
      sessions = sessions,
      mainSessionKey = mainSessionKey,
      onSelectSession = { key ->
        viewModel.switchChatSession(key)
        viewModel.refreshChatSessions(limit = 100)
      },
      onOpenSessions = onOpenSessions,
    )

    errorText?.takeIf { it.isNotBlank() }?.let { error ->
      ChatNotice(title = "Chat needs attention", body = userFacingChatError(error))
    }

    ChatMessageList(
      messages = messages,
      historyLoading = historyLoading,
      pendingRunCount = pendingRunCount,
      pendingToolCalls = pendingToolCalls,
      streamingAssistantText = streamingAssistantText,
      healthOk = healthOk,
      onStarterPrompt = { prompt -> input = prompt },
      modifier = Modifier.weight(1f),
    )

    ChatComposer(
      value = input,
      onValueChange = { input = it },
      attachments = attachments,
      thinkingLevel = thinkingLevel,
      healthOk = healthOk,
      pendingRunCount = pendingRunCount,
      onThinkingLevelChange = viewModel::setChatThinkingLevel,
      onPickImages = { pickImages.launch("image/*") },
      onRemoveAttachment = { id -> attachments.removeAll { it.id == id } },
      onVoice = onVoice,
      onAbort = viewModel::abortChat,
      onSend = {
        val message = input.trim()
        if (message.isEmpty() && attachments.isEmpty()) return@ChatComposer
        val outgoing =
          attachments.map { attachment ->
            OutgoingAttachment(
              type = "image",
              mimeType = attachment.mimeType,
              fileName = attachment.fileName,
              base64 = attachment.base64,
            )
          }
        input = ""
        attachments.clear()
        scope.launch {
          viewModel.sendChat(message = message, thinking = thinkingLevel, attachments = outgoing)
        }
      },
    )
  }
}

@Composable
private fun ChatSessionSwitcher(
  sessionKey: String,
  sessions: List<ChatSessionEntry>,
  mainSessionKey: String,
  onSelectSession: (String) -> Unit,
  onOpenSessions: () -> Unit,
) {
  val choices =
    remember(sessionKey, sessions, mainSessionKey) {
      resolveCompactSessionChoices(
        currentSessionKey = sessionKey,
        sessions = sessions,
        mainSessionKey = mainSessionKey,
      )
    }
  if (choices.size <= 1 && sessions.size <= 1) return

  Row(
    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(6.dp),
  ) {
    choices.forEach { entry ->
      ChatSessionChip(
        text = chatSessionChipText(entry = entry, mainSessionKey = mainSessionKey),
        active = isActiveSessionChoice(entry.key, sessionKey, mainSessionKey),
        onClick = { onSelectSession(entry.key) },
      )
    }
    if (sessions.size > choices.size) {
      Surface(
        onClick = onOpenSessions,
        modifier = Modifier.heightIn(min = 36.dp),
        shape = RoundedCornerShape(ACTAgentTheme.radii.pill),
        color = ACTAgentTheme.colors.canvas,
        contentColor = ACTAgentTheme.colors.textMuted,
        border = BorderStroke(1.dp, ACTAgentTheme.colors.border),
      ) {
        Row(
          modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
          Icon(imageVector = Icons.Default.MoreHoriz, contentDescription = null, modifier = Modifier.size(16.dp))
          Text(text = "All", style = ACTAgentTheme.type.caption, maxLines = 1)
        }
      }
    }
  }
}

@Composable
private fun ChatSessionChip(
  text: String,
  active: Boolean,
  onClick: () -> Unit,
) {
  Surface(
    onClick = onClick,
    modifier = Modifier.heightIn(min = 36.dp),
    shape = RoundedCornerShape(ACTAgentTheme.radii.pill),
    color = if (active) ACTAgentTheme.colors.primary else ACTAgentTheme.colors.surfaceRaised,
    contentColor = if (active) ACTAgentTheme.colors.primaryText else ACTAgentTheme.colors.text,
    border = BorderStroke(1.dp, if (active) ACTAgentTheme.colors.primary else ACTAgentTheme.colors.border),
  ) {
    Text(
      text = text,
      modifier = Modifier.padding(horizontal = 11.dp, vertical = 7.dp),
      style = ACTAgentTheme.type.caption,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
    )
  }
}

@Composable
private fun ChatHeader(
  sessionTitle: String,
  thinkingLevel: String,
  healthOk: Boolean,
  pendingRunCount: Int,
  onMore: () -> Unit,
) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(6.dp),
  ) {
    Box(modifier = Modifier.size(ACTAgentTheme.spacing.touchTarget))

    Column(
      modifier = Modifier.weight(1f),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
      Text(
        text = sessionTitle,
        style = ACTAgentTheme.type.title.copy(fontSize = 18.sp, lineHeight = 23.sp),
        color = ACTAgentTheme.colors.text,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        textAlign = TextAlign.Center,
      )
      ModelPill(
        text =
          when {
            pendingRunCount > 0 -> "Working"
            healthOk -> "auto"
            else -> "offline"
          },
        status =
          when {
            pendingRunCount > 0 -> ACTAgentStatus.Warning
            healthOk -> ACTAgentStatus.Neutral
            else -> ACTAgentStatus.Danger
          },
      )
    }

    HeaderIcon(icon = Icons.Default.Refresh, contentDescription = "Refresh chat", onClick = onMore)
  }
}

@Composable
private fun ModelPill(
  text: String,
  status: ACTAgentStatus,
) {
  val borderColor =
    if (status == ACTAgentStatus.Warning) {
      ACTAgentTheme.colors.warning
    } else {
      ACTAgentTheme.colors.border
    }
  Surface(
    shape = RoundedCornerShape(ACTAgentTheme.radii.pill),
    color = ACTAgentTheme.colors.surfaceRaised,
    contentColor = ACTAgentTheme.colors.textMuted,
    border = BorderStroke(1.dp, borderColor),
  ) {
    Text(
      text = text,
      modifier = Modifier.padding(horizontal = 7.dp, vertical = 1.5.dp),
      style = ACTAgentTheme.type.caption.copy(fontSize = 12.5.sp, lineHeight = 16.sp),
      maxLines = 1,
    )
  }
}

@Composable
private fun HeaderIcon(
  icon: androidx.compose.ui.graphics.vector.ImageVector,
  contentDescription: String,
  onClick: () -> Unit,
) {
  Surface(
    onClick = onClick,
    modifier = Modifier.size(ACTAgentTheme.spacing.touchTarget),
    shape = CircleShape,
    color = Color.Transparent,
    contentColor = ACTAgentTheme.colors.text,
  ) {
    Box(contentAlignment = Alignment.Center) {
      Icon(imageVector = icon, contentDescription = contentDescription, modifier = Modifier.size(20.dp))
    }
  }
}

@Composable
private fun ChatMessageList(
  messages: List<ChatMessage>,
  historyLoading: Boolean,
  pendingRunCount: Int,
  pendingToolCalls: List<ChatPendingToolCall>,
  streamingAssistantText: String?,
  healthOk: Boolean,
  onStarterPrompt: (String) -> Unit,
  modifier: Modifier = Modifier,
) {
  val listState = rememberLazyListState()
  val displayMessages = remember(messages) { messages.asReversed() }
  val stream = streamingAssistantText?.trim()

  LaunchedEffect(messages.size, pendingRunCount, pendingToolCalls.size) {
    listState.animateScrollToItem(index = 0)
  }
  LaunchedEffect(stream) {
    if (!stream.isNullOrEmpty()) {
      listState.scrollToItem(index = 0)
    }
  }

  Box(modifier = modifier.fillMaxWidth()) {
    LazyColumn(
      modifier = Modifier.fillMaxSize(),
      state = listState,
      reverseLayout = true,
      verticalArrangement = Arrangement.spacedBy(5.dp),
      contentPadding = PaddingValues(top = 6.dp, bottom = 3.dp),
    ) {
      if (!stream.isNullOrEmpty()) {
        item(key = "stream") {
          ChatBubble(role = "assistant", live = true, content = listOf(ChatMessageContent(text = stream)), timestampMs = null)
        }
      }

      if (pendingToolCalls.isNotEmpty()) {
        item(key = "tools") {
          ToolBubble(toolCalls = pendingToolCalls)
        }
      }

      if (pendingRunCount > 0) {
        item(key = "thinking") {
          ChatThinkingBubble()
        }
      }

      items(items = displayMessages, key = { it.id }) { message ->
        ChatBubble(role = message.role, live = false, content = message.content, timestampMs = message.timestampMs)
      }
    }

    if (messages.isEmpty() && pendingRunCount == 0 && pendingToolCalls.isEmpty() && stream.isNullOrBlank()) {
      if (historyLoading) {
        ACTAgentLoadingState(title = "Loading session", modifier = Modifier.align(Alignment.Center))
      } else {
        EmptyChatHint(healthOk = healthOk, onStarterPrompt = onStarterPrompt, modifier = Modifier.align(Alignment.Center))
      }
    }
  }
}

@Composable
private fun EmptyChatHint(
  healthOk: Boolean,
  onStarterPrompt: (String) -> Unit,
  modifier: Modifier = Modifier,
) {
  Column(
    modifier = modifier.fillMaxWidth().padding(horizontal = 2.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
      Text(text = if (healthOk) "Ready when you are" else "Gateway offline", style = ACTAgentTheme.type.title.copy(fontSize = 18.sp, lineHeight = 23.sp), color = ACTAgentTheme.colors.text)
      Text(
        text =
          if (healthOk) {
            "Start with a prompt, or use voice."
          } else {
            "Reconnect from Settings to send messages."
          },
        style = ACTAgentTheme.type.body,
        color = ACTAgentTheme.colors.textMuted,
        textAlign = TextAlign.Center,
      )
    }
    if (healthOk) {
      StarterPromptList(onStarterPrompt = onStarterPrompt)
    }
  }
}

@Composable
private fun StarterPromptList(onStarterPrompt: (String) -> Unit) {
  ACTAgentPanel(contentPadding = PaddingValues(horizontal = 0.dp, vertical = 0.dp)) {
    Column {
      starterPrompts.forEachIndexed { index, prompt ->
        StarterPromptRow(prompt = prompt, onClick = { onStarterPrompt(prompt.message) })
        if (index != starterPrompts.lastIndex) {
          HorizontalDivider(color = ACTAgentTheme.colors.border, thickness = 1.dp)
        }
      }
    }
  }
}

@Composable
private fun StarterPromptRow(
  prompt: StarterPrompt,
  onClick: () -> Unit,
) {
  Surface(onClick = onClick, color = Color.Transparent, contentColor = ACTAgentTheme.colors.text) {
    Row(
      modifier = Modifier.fillMaxWidth().heightIn(min = 54.dp).padding(horizontal = 10.dp, vertical = 6.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Box(
        modifier =
          Modifier
            .size(30.dp)
            .background(ACTAgentTheme.colors.surfacePressed, RoundedCornerShape(ACTAgentTheme.radii.row)),
        contentAlignment = Alignment.Center,
      ) {
        Text(text = prompt.mark, style = ACTAgentTheme.type.label, color = ACTAgentTheme.colors.text)
      }
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
        Text(text = prompt.title, style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.text, maxLines = 1)
        Text(text = prompt.subtitle, style = ACTAgentTheme.type.caption, color = ACTAgentTheme.colors.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
    }
  }
}

private data class StarterPrompt(
  val mark: String,
  val title: String,
  val subtitle: String,
  val message: String,
)

/** Default prompts shown only for an empty, connected session. */
private val starterPrompts =
  listOf(
    StarterPrompt(mark = "1", title = "Catch me up", subtitle = "Summarize recent sessions and next steps.", message = "Catch me up on my recent ACTAgent sessions and suggest next steps."),
    StarterPrompt(mark = "2", title = "Plan the work", subtitle = "Turn a goal into an actionable checklist.", message = "Help me turn this goal into a practical checklist: "),
    StarterPrompt(mark = "3", title = "Use this phone", subtitle = "Ask ACTAgent to use Android capabilities.", message = "What can you help me do from this phone right now?"),
  )

@Composable
private fun ChatBubble(
  role: String,
  live: Boolean,
  content: List<ChatMessageContent>,
  timestampMs: Long?,
) {
  val normalizedRole = role.trim().lowercase(Locale.US)
  val isUser = normalizedRole == "user"
  val displayableContent =
    content.filter { part ->
      when (part.type) {
        "text" -> !part.text.isNullOrBlank()
        "image" -> !part.base64.isNullOrBlank()
        else -> false
      }
    }
  if (displayableContent.isEmpty()) return

  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
  ) {
    Surface(
      modifier = Modifier.fillMaxWidth(if (isUser) 0.64f else 0.56f),
      shape = RoundedCornerShape(7.dp),
      color = ACTAgentTheme.colors.surfaceRaised,
      contentColor = ACTAgentTheme.colors.text,
      border = BorderStroke(1.dp, if (live) ACTAgentTheme.colors.borderStrong else ACTAgentTheme.colors.border),
    ) {
      Column(modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.5.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
          text =
            when {
              live -> "ACTAgent · Live"
              isUser -> "You"
              normalizedRole == "system" -> "System"
              else -> "ACTAgent"
            },
          style = ACTAgentTheme.type.caption.copy(fontSize = 12.5.sp, lineHeight = 16.sp, fontWeight = FontWeight.SemiBold),
          color = ACTAgentTheme.colors.text,
        )
        displayableContent.forEach { part ->
          if (part.type == "text") {
            ChatText(text = part.text.orEmpty(), textColor = ACTAgentTheme.colors.text)
          } else {
            Text(text = part.fileName ?: "Attachment", style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.textMuted)
          }
        }
        timestampMs?.let {
          Text(
            text = formatChatTimestamp(it),
            style = ACTAgentTheme.type.caption.copy(fontSize = 12.5.sp, lineHeight = 16.sp),
            color = ACTAgentTheme.colors.textMuted,
            modifier = Modifier.align(Alignment.End),
          )
        }
      }
    }
  }
}

@Composable
private fun ChatText(
  text: String,
  textColor: Color,
) {
  if (text.hasMarkdownSyntax()) {
    ChatMarkdown(text = text, textColor = textColor)
  } else {
    Text(
      text = text,
      style = ACTAgentTheme.type.body,
      color = textColor,
    )
  }
}

@Composable
private fun ToolBubble(toolCalls: List<ChatPendingToolCall>) {
  ACTAgentPanel {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
      ACTAgentStatusPill(text = "Tools running", status = ACTAgentStatus.Warning)
      toolCalls.take(4).forEach { tool ->
        ACTAgentListItem(title = tool.name, subtitle = "ACTAgent is working")
      }
      if (toolCalls.size > 4) {
        Text(text = "+${toolCalls.size - 4} more", style = ACTAgentTheme.type.caption, color = ACTAgentTheme.colors.textSubtle)
      }
    }
  }
}

@Composable
private fun ChatThinkingBubble() {
  ACTAgentPanel {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
      ACTAgentStatusPill(text = "Thinking", status = ACTAgentStatus.Warning)
      Text(text = "ACTAgent is preparing a response.", style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.textMuted)
    }
  }
}

@Composable
private fun ChatNotice(
  title: String,
  body: String,
) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(ACTAgentTheme.radii.panel),
    color = ACTAgentTheme.colors.surface,
    contentColor = ACTAgentTheme.colors.text,
    border = BorderStroke(1.dp, ACTAgentTheme.colors.border),
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 11.dp, vertical = 8.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
      Box(modifier = Modifier.size(6.dp).background(ACTAgentTheme.colors.warning, CircleShape))
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(text = title, style = ACTAgentTheme.type.section, color = ACTAgentTheme.colors.text)
        Text(text = body, style = ACTAgentTheme.type.caption, color = ACTAgentTheme.colors.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
    }
  }
}

@Composable
private fun ChatComposer(
  value: String,
  onValueChange: (String) -> Unit,
  attachments: List<PendingImageAttachment>,
  thinkingLevel: String,
  healthOk: Boolean,
  pendingRunCount: Int,
  onThinkingLevelChange: (String) -> Unit,
  onPickImages: () -> Unit,
  onRemoveAttachment: (String) -> Unit,
  onVoice: () -> Unit,
  onAbort: () -> Unit,
  onSend: () -> Unit,
) {
  Column(modifier = Modifier.fillMaxWidth().imePadding(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
    if (attachments.isNotEmpty()) {
      AttachmentStrip(attachments = attachments, onRemoveAttachment = onRemoveAttachment)
    }

    ChatContextMeter(thinkingLevel = thinkingLevel, onClick = { onThinkingLevelChange(nextThinkingValue(thinkingLevel)) })

    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
      ChatInputPill(value = value, onValueChange = onValueChange, onPickImages = onPickImages, onVoice = onVoice, modifier = Modifier.weight(1f))
      SendButton(
        enabled = healthOk && pendingRunCount == 0 && (value.trim().isNotEmpty() || attachments.isNotEmpty()),
        onClick = onSend,
      )
    }

    if (pendingRunCount > 0) {
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
        Surface(
          onClick = onAbort,
          modifier = Modifier.heightIn(min = ACTAgentTheme.spacing.touchTarget),
          shape = RoundedCornerShape(ACTAgentTheme.radii.pill),
          color = ACTAgentTheme.colors.canvas,
          contentColor = ACTAgentTheme.colors.text,
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
          ) {
            Box(modifier = Modifier.size(8.dp).background(ACTAgentTheme.colors.danger, RoundedCornerShape(2.dp)))
            Text(text = "Stop", style = ACTAgentTheme.type.label)
          }
        }
      }
    }
  }
}

@Composable
private fun ChatContextMeter(
  thinkingLevel: String,
  onClick: () -> Unit,
) {
  Row(
    modifier = Modifier.width(178.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(7.dp),
  ) {
    Surface(
      onClick = onClick,
      modifier = Modifier.heightIn(min = ACTAgentTheme.spacing.touchTarget),
      shape = RoundedCornerShape(ACTAgentTheme.radii.pill),
      color = ACTAgentTheme.colors.canvas,
      contentColor = ACTAgentTheme.colors.text,
    ) {
      Row(
        modifier = Modifier.padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        Icon(imageVector = Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(12.dp), tint = ACTAgentTheme.colors.textSubtle)
        Text(text = "Context ${contextPercent(thinkingLevel)}%", style = ACTAgentTheme.type.caption.copy(fontSize = 12.5.sp, lineHeight = 16.sp), color = ACTAgentTheme.colors.textMuted)
      }
    }
    Box(
      modifier =
        Modifier
          .weight(1f)
          .height(3.dp)
          .background(ACTAgentTheme.colors.surfacePressed, RoundedCornerShape(999.dp)),
    ) {
      Box(
        modifier =
          Modifier
            .fillMaxWidth(thinkingMeterWidth(thinkingLevel))
            .height(3.dp)
            .background(ACTAgentTheme.colors.primary, RoundedCornerShape(999.dp)),
      )
    }
  }
}

@Composable
private fun ChatInputPill(
  value: String,
  onValueChange: (String) -> Unit,
  onPickImages: () -> Unit,
  onVoice: () -> Unit,
  modifier: Modifier = Modifier,
) {
  Surface(
    modifier = modifier.heightIn(min = ACTAgentTheme.spacing.touchTarget),
    shape = RoundedCornerShape(ACTAgentTheme.radii.control),
    color = ACTAgentTheme.colors.surfaceRaised,
    contentColor = ACTAgentTheme.colors.text,
    border = BorderStroke(1.dp, ACTAgentTheme.colors.border),
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
      Surface(onClick = onPickImages, modifier = Modifier.size(ACTAgentTheme.spacing.touchTarget), shape = CircleShape, color = ACTAgentTheme.colors.surfaceRaised, contentColor = ACTAgentTheme.colors.text) {
        Box(contentAlignment = Alignment.Center) {
          Icon(imageVector = Icons.Default.AttachFile, contentDescription = "Attach image", modifier = Modifier.size(16.dp))
        }
      }
      Box(modifier = Modifier.weight(1f)) {
        BasicTextField(
          value = value,
          onValueChange = onValueChange,
          textStyle = ACTAgentTheme.type.body.copy(color = ACTAgentTheme.colors.text),
          cursorBrush = SolidColor(ACTAgentTheme.colors.primary),
          minLines = 1,
          maxLines = 4,
          modifier = Modifier.fillMaxWidth(),
          decorationBox = { innerTextField ->
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterStart) {
              if (value.isEmpty()) {
                Text(text = "Message ACTAgent", style = ACTAgentTheme.type.body, color = ACTAgentTheme.colors.textSubtle)
              }
              innerTextField()
            }
          },
        )
      }
      Surface(
        onClick = onVoice,
        modifier = Modifier.size(ACTAgentTheme.spacing.touchTarget),
        shape = CircleShape,
        color = ACTAgentTheme.colors.surfaceRaised,
        contentColor = ACTAgentTheme.colors.text,
      ) {
        Box(contentAlignment = Alignment.Center) {
          Icon(imageVector = Icons.Default.Mic, contentDescription = "Voice", modifier = Modifier.size(18.dp))
        }
      }
    }
  }
}

@Composable
private fun AttachmentStrip(
  attachments: List<PendingImageAttachment>,
  onRemoveAttachment: (String) -> Unit,
) {
  Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
    attachments.forEach { attachment ->
      AttachmentChip(fileName = attachment.fileName, onRemove = { onRemoveAttachment(attachment.id) })
    }
  }
}

@Composable
private fun AttachmentChip(
  fileName: String,
  onRemove: () -> Unit,
) {
  Surface(
    shape = RoundedCornerShape(ACTAgentTheme.radii.pill),
    color = ACTAgentTheme.colors.surfaceRaised,
    contentColor = ACTAgentTheme.colors.text,
    border = BorderStroke(1.dp, ACTAgentTheme.colors.border),
  ) {
    Row(
      modifier = Modifier.padding(start = 9.dp, top = 5.dp, end = 5.dp, bottom = 5.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
      Text(text = fileName, style = ACTAgentTheme.type.caption, color = ACTAgentTheme.colors.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
      Surface(onClick = onRemove, modifier = Modifier.size(22.dp), shape = CircleShape, color = ACTAgentTheme.colors.canvas, contentColor = ACTAgentTheme.colors.text) {
        Box(contentAlignment = Alignment.Center) {
          Icon(imageVector = Icons.Default.Close, contentDescription = "Remove attachment", modifier = Modifier.size(13.dp))
        }
      }
    }
  }
}

private fun currentSessionTitle(
  sessionKey: String,
  sessions: List<ChatSessionEntry>,
): String {
  val entry = sessions.firstOrNull { it.key == sessionKey }
  val name = entry?.displayName?.takeIf { it.isNotBlank() } ?: return "New chat"
  return friendlySessionName(name)
}

private fun chatSessionChipText(
  entry: ChatSessionEntry,
  mainSessionKey: String,
): String {
  val mainKey = mainSessionKey.trim().ifEmpty { "main" }
  if (entry.key == mainKey || (entry.key == "main" && mainKey == "main")) return "Main"
  val name = entry.displayName?.takeIf { it.isNotBlank() } ?: entry.key.takeIf { entry.updatedAtMs != null } ?: "Current"
  return friendlySessionName(name)
}

private fun isActiveSessionChoice(
  choiceKey: String,
  sessionKey: String,
  mainSessionKey: String,
): Boolean {
  val mainKey = mainSessionKey.trim().ifEmpty { "main" }
  val current = sessionKey.trim().let { if (it == "main" && mainKey != "main") mainKey else it }
  return choiceKey == current
}

@Composable
private fun SendButton(
  enabled: Boolean,
  onClick: () -> Unit,
) {
  Surface(
    onClick = onClick,
    enabled = enabled,
    modifier = Modifier.size(ACTAgentTheme.spacing.touchTarget),
    shape = CircleShape,
    color = if (enabled) ACTAgentTheme.colors.primary else ACTAgentTheme.colors.surfacePressed,
    contentColor = if (enabled) ACTAgentTheme.colors.primaryText else ACTAgentTheme.colors.textSubtle,
    border = BorderStroke(1.dp, if (enabled) ACTAgentTheme.colors.primary else ACTAgentTheme.colors.border),
  ) {
    Box(contentAlignment = Alignment.Center) {
      Icon(imageVector = Icons.AutoMirrored.Filled.Send, contentDescription = "Send", modifier = Modifier.size(18.dp))
    }
  }
}

private fun userFacingChatError(error: String): String {
  val lower = error.lowercase(Locale.US)
  return when {
    lower.contains("not connected") -> "Gateway is offline. Open Settings to reconnect."
    lower.contains("unauthorized") || lower.contains("auth") -> "Gateway authentication needs attention."
    else -> error
  }
}

/** Normalizes persisted thinking values into compact UI labels. */
private fun thinkingDisplay(value: String): String =
  when (value.lowercase(Locale.US)) {
    "low" -> "Low"
    "medium" -> "Medium"
    "high" -> "High"
    else -> "Off"
  }

/** Converts displayed thinking labels back to gateway request values. */
private fun thinkingValue(display: String): String =
  when (display.lowercase(Locale.US)) {
    "low" -> "low"
    "medium" -> "medium"
    "high" -> "high"
    else -> "off"
  }

/** Cycles through context budget presets from the compact composer control. */
private fun nextThinkingValue(value: String): String =
  when (value.lowercase(Locale.US)) {
    "off" -> "low"
    "low" -> "medium"
    "medium" -> "high"
    else -> "off"
  }

/** Maps thinking presets to the visual context meter fill fraction. */
private fun thinkingMeterWidth(value: String): Float =
  when (value.lowercase(Locale.US)) {
    "low" -> 0.34f
    "medium" -> 0.58f
    "high" -> 0.82f
    else -> 0.18f
  }

private fun contextPercent(value: String): Int = (thinkingMeterWidth(value) * 100).toInt()

private fun formatChatTimestamp(timestampMs: Long): String = DateFormat.getTimeInstance(DateFormat.SHORT, Locale.getDefault()).format(Date(timestampMs))

/** Quick markdown detector used to avoid routing plain chat text through the markdown renderer. */
private fun String.hasMarkdownSyntax(): Boolean =
  any { it == '#' || it == '*' || it == '`' || it == '[' || it == '|' } ||
    contains("\n- ") ||
    contains("\n1. ")
