import Foundation

// Stable identifier used for both the macOS LaunchAgent label and Nix-managed defaults suite.
// nix-actagent writes app defaults into this suite to survive app bundle identifier churn.
let launchdLabel = "ai.actagent.mac"
let gatewayLaunchdLabel = "ai.actagent.gateway"
let onboardingVersionKey = "actagent.onboardingVersion"
let onboardingSeenKey = "actagent.onboardingSeen"
let currentOnboardingVersion = 7
let pauseDefaultsKey = "actagent.pauseEnabled"
let iconAnimationsEnabledKey = "actagent.iconAnimationsEnabled"
let swabbleEnabledKey = "actagent.swabbleEnabled"
let swabbleTriggersKey = "actagent.swabbleTriggers"
let voiceWakeTriggerChimeKey = "actagent.voiceWakeTriggerChime"
let voiceWakeSendChimeKey = "actagent.voiceWakeSendChime"
let showDockIconKey = "actagent.showDockIcon"
let defaultVoiceWakeTriggers = ["actagent"]
let voiceWakeMaxWords = 32
let voiceWakeMaxWordLength = 64
let voiceWakeMicKey = "actagent.voiceWakeMicID"
let voiceWakeMicNameKey = "actagent.voiceWakeMicName"
let voiceWakeLocaleKey = "actagent.voiceWakeLocaleID"
let voiceWakeAdditionalLocalesKey = "actagent.voiceWakeAdditionalLocaleIDs"
let voicePushToTalkEnabledKey = "actagent.voicePushToTalkEnabled"
let voiceWakeTriggersTalkModeKey = "actagent.voiceWakeTriggersTalkMode"
let talkEnabledKey = "actagent.talkEnabled"
let talkPhaseSoundsEnabledKey = "actagent.talkPhaseSoundsEnabled"
let talkShiftToStopEnabledKey = "actagent.talkShiftToStopEnabled"
let iconOverrideKey = "actagent.iconOverride"
let connectionModeKey = "actagent.connectionMode"
let remoteTargetKey = "actagent.remoteTarget"
let remoteIdentityKey = "actagent.remoteIdentity"
let remoteProjectRootKey = "actagent.remoteProjectRoot"
let remoteCliPathKey = "actagent.remoteCliPath"
let canvasEnabledKey = "actagent.canvasEnabled"
let cameraEnabledKey = "actagent.cameraEnabled"
let systemRunPolicyKey = "actagent.systemRunPolicy"
let systemRunAllowlistKey = "actagent.systemRunAllowlist"
let systemRunEnabledKey = "actagent.systemRunEnabled"
let locationModeKey = "actagent.locationMode"
let locationPreciseKey = "actagent.locationPreciseEnabled"
let peekabooBridgeEnabledKey = "actagent.peekabooBridgeEnabled"
let deepLinkKeyKey = "actagent.deepLinkKey"
let cliInstallPromptedVersionKey = "actagent.cliInstallPromptedVersion"
let heartbeatsEnabledKey = "actagent.heartbeatsEnabled"
let debugPaneEnabledKey = "actagent.debugPaneEnabled"
let debugFileLogEnabledKey = "actagent.debug.fileLogEnabled"
let appLogLevelKey = "actagent.debug.appLogLevel"
let voiceWakeSupported: Bool = ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26
