import Foundation

public enum ACTAgentDeviceCommand: String, Codable, Sendable {
    case status = "device.status"
    case info = "device.info"
}

public enum ACTAgentBatteryState: String, Codable, Sendable {
    case unknown
    case unplugged
    case charging
    case full
}

public enum ACTAgentThermalState: String, Codable, Sendable {
    case nominal
    case fair
    case serious
    case critical
}

public enum ACTAgentNetworkPathStatus: String, Codable, Sendable {
    case satisfied
    case unsatisfied
    case requiresConnection
}

public enum ACTAgentNetworkInterfaceType: String, Codable, Sendable {
    case wifi
    case cellular
    case wired
    case other
}

public struct ACTAgentBatteryStatusPayload: Codable, Sendable, Equatable {
    public var level: Double?
    public var state: ACTAgentBatteryState
    public var lowPowerModeEnabled: Bool

    public init(level: Double?, state: ACTAgentBatteryState, lowPowerModeEnabled: Bool) {
        self.level = level
        self.state = state
        self.lowPowerModeEnabled = lowPowerModeEnabled
    }
}

public struct ACTAgentThermalStatusPayload: Codable, Sendable, Equatable {
    public var state: ACTAgentThermalState

    public init(state: ACTAgentThermalState) {
        self.state = state
    }
}

public struct ACTAgentStorageStatusPayload: Codable, Sendable, Equatable {
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var usedBytes: Int64

    public init(totalBytes: Int64, freeBytes: Int64, usedBytes: Int64) {
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.usedBytes = usedBytes
    }
}

public struct ACTAgentNetworkStatusPayload: Codable, Sendable, Equatable {
    public var status: ACTAgentNetworkPathStatus
    public var isExpensive: Bool
    public var isConstrained: Bool
    public var interfaces: [ACTAgentNetworkInterfaceType]

    public init(
        status: ACTAgentNetworkPathStatus,
        isExpensive: Bool,
        isConstrained: Bool,
        interfaces: [ACTAgentNetworkInterfaceType])
    {
        self.status = status
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.interfaces = interfaces
    }
}

public struct ACTAgentDeviceStatusPayload: Codable, Sendable, Equatable {
    public var battery: ACTAgentBatteryStatusPayload
    public var thermal: ACTAgentThermalStatusPayload
    public var storage: ACTAgentStorageStatusPayload
    public var network: ACTAgentNetworkStatusPayload
    public var uptimeSeconds: Double

    public init(
        battery: ACTAgentBatteryStatusPayload,
        thermal: ACTAgentThermalStatusPayload,
        storage: ACTAgentStorageStatusPayload,
        network: ACTAgentNetworkStatusPayload,
        uptimeSeconds: Double)
    {
        self.battery = battery
        self.thermal = thermal
        self.storage = storage
        self.network = network
        self.uptimeSeconds = uptimeSeconds
    }
}

public struct ACTAgentDeviceInfoPayload: Codable, Sendable, Equatable {
    public var deviceName: String
    public var modelIdentifier: String
    public var systemName: String
    public var systemVersion: String
    public var appVersion: String
    public var appBuild: String
    public var locale: String

    public init(
        deviceName: String,
        modelIdentifier: String,
        systemName: String,
        systemVersion: String,
        appVersion: String,
        appBuild: String,
        locale: String)
    {
        self.deviceName = deviceName
        self.modelIdentifier = modelIdentifier
        self.systemName = systemName
        self.systemVersion = systemVersion
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.locale = locale
    }
}
