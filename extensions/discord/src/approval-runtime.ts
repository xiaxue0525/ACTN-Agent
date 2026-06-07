// Discord plugin module implements approval runtime behavior.
export {
  isChannelExecApprovalClientEnabledFromConfig,
  matchesApprovalRequestFilters,
  getExecApprovalReplyMetadata,
} from "actagent/plugin-sdk/approval-client-runtime";
export { resolveApprovalApprovers } from "actagent/plugin-sdk/approval-auth-runtime";
export {
  createApproverRestrictedNativeApprovalCapability,
  splitChannelApprovalCapability,
} from "actagent/plugin-sdk/approval-delivery-runtime";
export {
  createChannelApproverDmTargetResolver,
  createChannelNativeOriginTargetResolver,
} from "actagent/plugin-sdk/approval-native-runtime";
