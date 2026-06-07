import Testing
@testable import ACTAgent

@Suite(.serialized) struct ACTAgentAppDelegateTests {
    @Test @MainActor func resolvesRegistryModelBeforeViewTaskAssignsDelegateModel() {
        let registryModel = NodeAppModel()
        ACTAgentAppModelRegistry.appModel = registryModel
        defer { ACTAgentAppModelRegistry.appModel = nil }

        let delegate = ACTAgentAppDelegate()

        #expect(delegate._test_resolvedAppModel() === registryModel)
    }

    @Test @MainActor func prefersExplicitDelegateModelOverRegistryFallback() {
        let registryModel = NodeAppModel()
        let explicitModel = NodeAppModel()
        ACTAgentAppModelRegistry.appModel = registryModel
        defer { ACTAgentAppModelRegistry.appModel = nil }

        let delegate = ACTAgentAppDelegate()
        delegate.appModel = explicitModel

        #expect(delegate._test_resolvedAppModel() === explicitModel)
    }
}
