/**
 * Help examples shown by the Browser CLI root command.
 */
/** Core Browser CLI examples for lifecycle and inspection commands. */
export const browserCoreExamples = [
  "actagent browser status",
  "actagent browser start",
  "actagent browser start --headless",
  "actagent browser stop",
  "actagent browser tabs",
  "actagent browser open https://example.com",
  "actagent browser focus abcd1234",
  "actagent browser close abcd1234",
  "actagent browser screenshot",
  "actagent browser screenshot --full-page",
  "actagent browser screenshot --ref 12",
  "actagent browser snapshot",
  "actagent browser snapshot --format aria --limit 200",
  "actagent browser snapshot --efficient",
  "actagent browser snapshot --labels",
];

/** Browser CLI examples for interaction/action commands. */
export const browserActionExamples = [
  "actagent browser navigate https://example.com",
  "actagent browser resize 1280 720",
  "actagent browser click 12 --double",
  "actagent browser click-coords 120 340",
  'actagent browser type 23 "hello" --submit',
  "actagent browser press Enter",
  "actagent browser hover 44",
  "actagent browser drag 10 11",
  "actagent browser select 9 OptionA OptionB",
  "actagent browser upload /tmp/actagent/uploads/file.pdf",
  "actagent browser upload media://inbound/file.pdf",
  'actagent browser fill --fields \'[{"ref":"1","value":"Ada"}]\'',
  "actagent browser dialog --accept",
  'actagent browser wait --text "Done"',
  "actagent browser evaluate --fn '(el) => el.textContent' --ref 7",
  "actagent browser console --level error",
  "actagent browser pdf",
];
