import CoreLocation
import Foundation
import ACTAgentKit
import UIKit

typealias ACTAgentCameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias ACTAgentCameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: ACTAgentCameraSnapParams) async throws -> ACTAgentCameraSnapResult
    func clip(params: ACTAgentCameraClipParams) async throws -> ACTAgentCameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: ACTAgentLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: ACTAgentLocationGetParams,
        desiredAccuracy: ACTAgentLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: ACTAgentLocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

@MainActor
protocol DeviceStatusServicing: Sendable {
    func status() async throws -> ACTAgentDeviceStatusPayload
    func info() -> ACTAgentDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: ACTAgentPhotosLatestParams) async throws -> ACTAgentPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: ACTAgentContactsSearchParams) async throws -> ACTAgentContactsSearchPayload
    func add(params: ACTAgentContactsAddParams) async throws -> ACTAgentContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: ACTAgentCalendarEventsParams) async throws -> ACTAgentCalendarEventsPayload
    func add(params: ACTAgentCalendarAddParams) async throws -> ACTAgentCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: ACTAgentRemindersListParams) async throws -> ACTAgentRemindersListPayload
    func add(params: ACTAgentRemindersAddParams) async throws -> ACTAgentRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: ACTAgentMotionActivityParams) async throws -> ACTAgentMotionActivityPayload
    func pedometer(params: ACTAgentPedometerParams) async throws -> ACTAgentPedometerPayload
}

struct WatchMessagingStatus: Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalResolveEvent: Equatable {
    var replyId: String
    var approvalId: String
    var decision: ACTAgentWatchExecApprovalDecision
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalSnapshotRequestEvent: Equatable {
    var requestId: String
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setStatusHandler(_ handler: (@Sendable (WatchMessagingStatus) -> Void)?)
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func setExecApprovalResolveHandler(_ handler: (@Sendable (WatchExecApprovalResolveEvent) -> Void)?)
    func setExecApprovalSnapshotRequestHandler(
        _ handler: (@Sendable (WatchExecApprovalSnapshotRequestEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: ACTAgentWatchNotifyParams) async throws -> WatchNotificationSendResult
    func sendExecApprovalPrompt(
        _ message: ACTAgentWatchExecApprovalPromptMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalResolved(
        _ message: ACTAgentWatchExecApprovalResolvedMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalExpired(
        _ message: ACTAgentWatchExecApprovalExpiredMessage) async throws -> WatchNotificationSendResult
    func syncExecApprovalSnapshot(
        _ message: ACTAgentWatchExecApprovalSnapshotMessage) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
