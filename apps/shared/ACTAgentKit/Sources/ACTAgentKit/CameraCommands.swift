import Foundation

public enum ACTAgentCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum ACTAgentCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum ACTAgentCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum ACTAgentCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct ACTAgentCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: ACTAgentCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: ACTAgentCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: ACTAgentCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: ACTAgentCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct ACTAgentCameraClipParams: Codable, Sendable, Equatable {
    public var facing: ACTAgentCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: ACTAgentCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: ACTAgentCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: ACTAgentCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
