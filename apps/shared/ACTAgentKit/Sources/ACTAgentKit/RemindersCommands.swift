import Foundation

public enum ACTAgentRemindersCommand: String, Codable, Sendable {
    case list = "reminders.list"
    case add = "reminders.add"
}

public enum ACTAgentReminderStatusFilter: String, Codable, Sendable {
    case incomplete
    case completed
    case all
}

public struct ACTAgentRemindersListParams: Codable, Sendable, Equatable {
    public var status: ACTAgentReminderStatusFilter?
    public var limit: Int?

    public init(status: ACTAgentReminderStatusFilter? = nil, limit: Int? = nil) {
        self.status = status
        self.limit = limit
    }
}

public struct ACTAgentRemindersAddParams: Codable, Sendable, Equatable {
    public var title: String
    public var dueISO: String?
    public var notes: String?
    public var listId: String?
    public var listName: String?

    public init(
        title: String,
        dueISO: String? = nil,
        notes: String? = nil,
        listId: String? = nil,
        listName: String? = nil)
    {
        self.title = title
        self.dueISO = dueISO
        self.notes = notes
        self.listId = listId
        self.listName = listName
    }
}

public struct ACTAgentReminderPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var title: String
    public var dueISO: String?
    public var completed: Bool
    public var listName: String?

    public init(
        identifier: String,
        title: String,
        dueISO: String? = nil,
        completed: Bool,
        listName: String? = nil)
    {
        self.identifier = identifier
        self.title = title
        self.dueISO = dueISO
        self.completed = completed
        self.listName = listName
    }
}

public struct ACTAgentRemindersListPayload: Codable, Sendable, Equatable {
    public var reminders: [ACTAgentReminderPayload]

    public init(reminders: [ACTAgentReminderPayload]) {
        self.reminders = reminders
    }
}

public struct ACTAgentRemindersAddPayload: Codable, Sendable, Equatable {
    public var reminder: ACTAgentReminderPayload

    public init(reminder: ACTAgentReminderPayload) {
        self.reminder = reminder
    }
}
