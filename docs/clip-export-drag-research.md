# Dragging exported videos to other websites

Research date: 7 November 2026. This concerns a completed, browser-generated MP4, not dragging an existing file from Downloads or dragging a video URL.

## Product decision

One selected output downloads automatically as an MP4 and opens a playable preview. Download MP4 can save it again if needed. Two or more selected outputs download automatically as one ZIP, without a video preview. Clip ZIPs contain videos only; progress and failures remain in the export UI. Selecting Desktop and Mobile for one clip means ZIP, even if one version subsequently fails.

Outgoing dragging is disabled in the product. The initial prototype supplied an actual finished File synchronously through DataTransfer.items.add, but an available API and visible drag image did not establish cross-window delivery. Do not advertise a drag gesture without verified end-to-end transport. There is no reliable general feature test for delivery to an unrelated website or operating-system window.

The creator tested Safari on a MacBook Pro: the preview produced a drag image inside the source window, then the gesture stopped when leaving the window and did not deliver the video into another window. This is a user-reported failure on that setup, not evidence that every macOS browser is unsupported; Safari/macOS versions and the destination were not supplied.

## What must work

| Boundary                     | Requirement                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clipify                      | Finish encoding, keep the complete File available, add it during the synchronous drag-start event. A thumbnail, video element or Blob URL alone does not supply a file.                                            |
| Browser and operating system | Preserve file bytes across the renderer/native drag boundary. This varies by engine, version and OS. Desktop file promises and touch interactions are separate capabilities.                                       |
| Receiving website            | Accept the drag, normally cancelling `dragover`, read file items during `drop`, and accept the file's MIME type, codec, size and account upload allowance. A visible upload area does not establish compatibility. |

The drag data store is writable during drag start and file data is readable at drop; asynchronous generation inside drag start is too late. [MDN's drag data store guide](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Drag_data_store) explains these restrictions.

A genuine File handoff is different from fetching a URL. CORS headers do not fix a browser discarding the file payload. A `blob:` URL is scoped to its creator's origin and cannot be treated as a public video URL by another site.

## Browser assessment

| Browser/platform               | Evidence                                                                                                                                                                                             | Conclusion for generated MP4 drag                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Chrome/Edge desktop            | Chromium's source still marks `DragAndDropJSFileObjects` as test-only and explicitly describes filename-only legacy transport. Its implementation design initially covers image MIME types, not MP4. | Do not promise arbitrary MP4 handoff to another site or the desktop. Installing an API-compatible browser is insufficient. |
| Firefox desktop                | The Chromium implementation author documents Firefox delivering constructed Files to native Windows applications. Local Firefox transferred MP4 bytes within the source page.                        | Firefox is not categorically unsupported. Cross-site and OS-specific delivery still require target testing.                |
| Safari on macOS                | Linux WebKit is not Safari on a Mac. The creator reports a failed cross-window Safari attempt on a MacBook Pro; exact versions/destination are unspecified.                                          | Not certified. Keep download/file-picker fallback.                                                                         |
| iOS/iPadOS and Android         | No real-device, cross-application MP4 drag test was available. Touch drag, split screen and the receiving app are additional constraints.                                                            | Not certified. Do not infer support from desktop API tables or video encoding support.                                     |
| Different browsers or profiles | Passing files between native windows involves another transport boundary.                                                                                                                            | Not certified by a same-page test.                                                                                         |

Primary implementation evidence: [Chromium runtime flags](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/runtime_enabled_features.json5), [the implementation author's design](https://joone.github.io/posts/design-doc-support-dragging-js-file-objects-to-native-drop-targets/). These establish limitations, not a complete browser/version support list.

Firefox's missing `DownloadURL` support is a different issue. That nonstandard Chromium mechanism describes a downloadable URL rather than providing a portable File drag implementation. [Mozilla's open DownloadURL issue](https://bugzilla.mozilla.org/show_bug.cgi?id=570164) and [Microsoft's explainer](https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/DownloadURL-list/explainer.md) document the distinction and native platform differences. It is not a Firefox polyfill, nor a guarantee for generated Blob URLs.

Receiver code matters too: [Mozilla's Synology investigation](https://bugzilla.mozilla.org/show_bug.cgi?id=2035190) records a receiver depending on a removed proprietary drag type. That is an example of site-specific incompatibility, not evidence that every Firefox upload fails.

## Local investigation

Playwright mouse gestures, without synthesizing a drop event, used a 107,301-byte synthetic MP4. Test modes were text, a constructed File, a file-input File, and an OPFS File. Targets were the same page and a different-origin iframe. Engines ran headless on Linux, without experimental flags.

| Engine                | Same-page control                                                                                           | Different-origin result                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chromium 156.0.8078.4 | Text worked; generated/OPFS MP4 became filename text. File-input control also failed to deliver a File.     | Text control failed, so this target path is inconclusive.                                                                                                                 |
| Firefox 157.0         | Text and all three File variants worked; MP4 name, MIME, exact byte length and `ftyp` header were readable. | Text worked. File types were advertised, but reading File.name threw a permission error for all three variants, including the ordinary file-input control. Not certified. |
| Linux WebKit 27.2     | Text worked; generated and file-input Files were absent. OPFS preparation failed in this runtime.           | Text control failed, so this target path is inconclusive.                                                                                                                 |

These results deliberately do not turn a failed control into a browser-wide unsupported claim. The initial app acceptance tests verified completed MP4 playback, dimensions/audio and the actual File attached at native drag start; they did not establish delivery into YouTube Studio. Current regression checks verify that the preview cannot start an outgoing drag while automatic MP4/ZIP downloads and manual repeat downloads remain available.

## Shipping and verification

There is no reliable JavaScript boolean meaning “this file will upload to that other website.” Checking source APIs cannot establish end-to-end support. Do not require browser flags or attempt to bypass file permissions. A web-only polyfill cannot implement a missing native transport. Native helpers/extensions would be a separate product decision.

Before advertising a target as supported, test actual Windows/macOS hardware and relevant mobile devices with the real destination: drag from Clipify into its upload area, confirm the received file name and size, complete processing and play the uploaded result. Repeat across tabs, split windows and browsers if those routes are advertised. Use an ordinary file from Downloads as a positive control. If it fails too, separate receiver/automation issues from generated-file transport.

Until then, downloading the MP4 and selecting or dragging the downloaded file is the dependable fallback. No external upload or third-party account mutation was performed during this investigation.
