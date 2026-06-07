import Foundation
import SwabbleKit
import Testing
@testable import ACTAgent

private let actagentTranscript = "hey actagent do thing"

private func actagentSegments(postTriggerStart: TimeInterval) -> [WakeWordSegment] {
    makeSegments(
        transcript: actagentTranscript,
        words: [
            ("hey", 0.0, 0.1),
            ("actagent", 0.2, 0.1),
            ("do", postTriggerStart, 0.1),
            ("thing", postTriggerStart + 0.2, 0.1),
        ])
}

@Suite struct VoiceWakeManagerExtractCommandTests {
    @Test func extractCommandReturnsNilWhenNoTriggerFound() {
        let transcript = "hello world"
        let segments = makeSegments(
            transcript: transcript,
            words: [("hello", 0.0, 0.1), ("world", 0.2, 0.1)])
        #expect(VoiceWakeManager.extractCommand(from: transcript, segments: segments, triggers: ["actagent"]) == nil)
    }

    @Test func extractCommandTrimsTokensAndResult() {
        let segments = actagentSegments(postTriggerStart: 0.9)
        let cmd = VoiceWakeManager.extractCommand(
            from: actagentTranscript,
            segments: segments,
            triggers: ["  actagent  "],
            minPostTriggerGap: 0.3)
        #expect(cmd == "do thing")
    }

    @Test func extractCommandReturnsNilWhenGapTooShort() {
        let segments = actagentSegments(postTriggerStart: 0.35)
        let cmd = VoiceWakeManager.extractCommand(
            from: actagentTranscript,
            segments: segments,
            triggers: ["actagent"],
            minPostTriggerGap: 0.3)
        #expect(cmd == nil)
    }

    @Test func extractCommandReturnsNilWhenNothingAfterTrigger() {
        let transcript = "hey actagent"
        let segments = makeSegments(
            transcript: transcript,
            words: [("hey", 0.0, 0.1), ("actagent", 0.2, 0.1)])
        #expect(VoiceWakeManager.extractCommand(from: transcript, segments: segments, triggers: ["actagent"]) == nil)
    }

    @Test func extractCommandIgnoresEmptyTriggers() {
        let segments = actagentSegments(postTriggerStart: 0.9)
        let cmd = VoiceWakeManager.extractCommand(
            from: actagentTranscript,
            segments: segments,
            triggers: ["", "   ", "actagent"],
            minPostTriggerGap: 0.3)
        #expect(cmd == "do thing")
    }
}

private func makeSegments(
    transcript: String,
    words: [(String, TimeInterval, TimeInterval)])
-> [WakeWordSegment] {
    var searchStart = transcript.startIndex
    var output: [WakeWordSegment] = []
    for (word, start, duration) in words {
        let range = transcript.range(of: word, range: searchStart..<transcript.endIndex)
        output.append(WakeWordSegment(text: word, start: start, duration: duration, range: range))
        if let range { searchStart = range.upperBound }
    }
    return output
}
