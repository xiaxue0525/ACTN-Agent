// swift-tools-version: 6.2
// Package manifest for the ACTAgent macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "ACTAgent",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "ACTAgentIPC", targets: ["ACTAgentIPC"]),
        .library(name: "ACTAgentDiscovery", targets: ["ACTAgentDiscovery"]),
        .executable(name: "ACTAgent", targets: ["ACTAgent"]),
        .executable(name: "actagent-mac", targets: ["ACTAgentMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.3.1"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.4.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.10.1"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.9.0"),
        .package(url: "https://github.com/steipete/Peekaboo.git", exact: "3.2.1"),
        .package(path: "../shared/ACTAgentKit"),
        .package(path: "../swabble"),
    ],
    targets: [
        .target(
            name: "ACTAgentIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "ACTAgentDiscovery",
            dependencies: [
                .product(name: "ACTAgentKit", package: "ACTAgentKit"),
            ],
            path: "Sources/ACTAgentDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "ACTAgent",
            dependencies: [
                "ACTAgentIPC",
                "ACTAgentDiscovery",
                .product(name: "ACTAgentKit", package: "ACTAgentKit"),
                .product(name: "ACTAgentChatUI", package: "ACTAgentKit"),
                .product(name: "ACTAgentProtocol", package: "ACTAgentKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/ACTAgent.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "ACTAgentMacCLI",
            dependencies: [
                "ACTAgentDiscovery",
                .product(name: "ACTAgentKit", package: "ACTAgentKit"),
                .product(name: "ACTAgentProtocol", package: "ACTAgentKit"),
            ],
            path: "Sources/ACTAgentMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "ACTAgentIPCTests",
            dependencies: [
                "ACTAgentIPC",
                "ACTAgent",
                "ACTAgentMacCLI",
                "ACTAgentDiscovery",
                .product(name: "ACTAgentProtocol", package: "ACTAgentKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
