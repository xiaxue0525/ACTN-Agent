package ai.actagent.app.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class ACTAgentProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", ACTAgentCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", ACTAgentCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", ACTAgentCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", ACTAgentCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", ACTAgentCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", ACTAgentCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", ACTAgentCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", ACTAgentCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", ACTAgentCapability.Canvas.rawValue)
    assertEquals("camera", ACTAgentCapability.Camera.rawValue)
    assertEquals("voiceWake", ACTAgentCapability.VoiceWake.rawValue)
    assertEquals("talk", ACTAgentCapability.Talk.rawValue)
    assertEquals("location", ACTAgentCapability.Location.rawValue)
    assertEquals("sms", ACTAgentCapability.Sms.rawValue)
    assertEquals("device", ACTAgentCapability.Device.rawValue)
    assertEquals("notifications", ACTAgentCapability.Notifications.rawValue)
    assertEquals("system", ACTAgentCapability.System.rawValue)
    assertEquals("photos", ACTAgentCapability.Photos.rawValue)
    assertEquals("contacts", ACTAgentCapability.Contacts.rawValue)
    assertEquals("calendar", ACTAgentCapability.Calendar.rawValue)
    assertEquals("motion", ACTAgentCapability.Motion.rawValue)
    assertEquals("callLog", ACTAgentCapability.CallLog.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", ACTAgentCameraCommand.List.rawValue)
    assertEquals("camera.snap", ACTAgentCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", ACTAgentCameraCommand.Clip.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", ACTAgentNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", ACTAgentNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", ACTAgentDeviceCommand.Status.rawValue)
    assertEquals("device.info", ACTAgentDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", ACTAgentDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", ACTAgentDeviceCommand.Health.rawValue)
    assertEquals("device.apps", ACTAgentDeviceCommand.Apps.rawValue)
  }

  @Test
  fun systemCommandsUseStableStrings() {
    assertEquals("system.notify", ACTAgentSystemCommand.Notify.rawValue)
  }

  @Test
  fun photosCommandsUseStableStrings() {
    assertEquals("photos.latest", ACTAgentPhotosCommand.Latest.rawValue)
  }

  @Test
  fun contactsCommandsUseStableStrings() {
    assertEquals("contacts.search", ACTAgentContactsCommand.Search.rawValue)
    assertEquals("contacts.add", ACTAgentContactsCommand.Add.rawValue)
  }

  @Test
  fun calendarCommandsUseStableStrings() {
    assertEquals("calendar.events", ACTAgentCalendarCommand.Events.rawValue)
    assertEquals("calendar.add", ACTAgentCalendarCommand.Add.rawValue)
  }

  @Test
  fun motionCommandsUseStableStrings() {
    assertEquals("motion.activity", ACTAgentMotionCommand.Activity.rawValue)
    assertEquals("motion.pedometer", ACTAgentMotionCommand.Pedometer.rawValue)
  }

  @Test
  fun smsCommandsUseStableStrings() {
    assertEquals("sms.send", ACTAgentSmsCommand.Send.rawValue)
    assertEquals("sms.search", ACTAgentSmsCommand.Search.rawValue)
  }

  @Test
  fun talkCommandsUseStableStrings() {
    assertEquals("talk.ptt.start", ACTAgentTalkCommand.PttStart.rawValue)
    assertEquals("talk.ptt.stop", ACTAgentTalkCommand.PttStop.rawValue)
    assertEquals("talk.ptt.cancel", ACTAgentTalkCommand.PttCancel.rawValue)
    assertEquals("talk.ptt.once", ACTAgentTalkCommand.PttOnce.rawValue)
  }

  @Test
  fun callLogCommandsUseStableStrings() {
    assertEquals("callLog.search", ACTAgentCallLogCommand.Search.rawValue)
  }
}
