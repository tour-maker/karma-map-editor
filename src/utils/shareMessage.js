// navigator.share() hands the OS share sheet a `text` and a separate `url`, and targets such
// as WhatsApp append the `url` to the `text` themselves. A message that already contains its
// own link therefore shows that link twice. This returns the text for the native share
// call: same message, with the link removed (it travels in `url` instead). The clipboard /
// WhatsApp-link fallbacks only receive one string, so they keep using the original text.
export function stripShareUrl(text, url) {
  const message = String(text ?? '');
  if (!url) return message;
  return message
    .split(String(url)).join('')
    .replace(/[ \t]+\n/g, '\n')
    .trimEnd();
}
