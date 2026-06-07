import Foundation
import Testing
@testable import ACTAgent

@Suite(.serialized) struct NodeServiceManagerTests {
    @Test func `builds node service commands with current CLI shape`() async throws {
        try await TestIsolation.withUserDefaultsValues(["actagent.gatewayProjectRootPath": nil]) {
            let tmp = try makeTempDirForTests()
            CommandResolver.setProjectRoot(tmp.path)

            let actagentPath = tmp.appendingPathComponent("node_modules/.bin/actagent")
            try makeExecutableForTests(at: actagentPath)

            let start = NodeServiceManager._testServiceCommand(["start"])
            #expect(start == [actagentPath.path, "node", "start", "--json"])

            let stop = NodeServiceManager._testServiceCommand(["stop"])
            #expect(stop == [actagentPath.path, "node", "stop", "--json"])
        }
    }
}
