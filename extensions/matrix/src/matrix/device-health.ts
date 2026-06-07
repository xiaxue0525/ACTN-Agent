// Matrix plugin module implements device health behavior.
export type MatrixManagedDeviceInfo = {
  deviceId: string;
  displayName: string | null;
  current: boolean;
};

export type MatrixDeviceHealthSummary = {
  currentDeviceId: string | null;
  staleACTAgentDevices: MatrixManagedDeviceInfo[];
  currentACTAgentDevices: MatrixManagedDeviceInfo[];
};

const ACTAGENT_DEVICE_NAME_PREFIX = "ACTAgent ";

export function isACTAgentManagedMatrixDevice(displayName: string | null | undefined): boolean {
  return displayName?.startsWith(ACTAGENT_DEVICE_NAME_PREFIX) === true;
}

export function summarizeMatrixDeviceHealth(
  devices: MatrixManagedDeviceInfo[],
): MatrixDeviceHealthSummary {
  const currentDeviceId = devices.find((device) => device.current)?.deviceId ?? null;
  const actAgentDevices = devices.filter((device) =>
    isACTAgentManagedMatrixDevice(device.displayName),
  );
  return {
    currentDeviceId,
    staleACTAgentDevices: actAgentDevices.filter((device) => !device.current),
    currentACTAgentDevices: actAgentDevices.filter((device) => device.current),
  };
}
