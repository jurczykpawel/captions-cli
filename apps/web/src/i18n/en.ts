import type { Dict } from './index';

export const en: Dict = {
  meta: {
    title: 'Captions — burn captions onto your video, 100% in your browser',
    description:
      'Add animated word-by-word captions to your videos locally. Your files never leave your device. Free, no upload, no account.',
  },
  hero: {
    badge: '100% local · no upload',
    title: 'Caption your video without uploading it anywhere',
    subtitle:
      'Drop in a clip, get animated word-by-word captions, and export a finished MP4. Everything runs on your own computer, right here in the browser.',
    cta: 'Add a video',
    secondary: 'How it works',
  },
  privacy: {
    heading: 'Your video stays on your device',
    local: 'Every step runs locally in your browser using your computer.',
    noUpload: 'Your video is never uploaded to any server.',
    noStore: 'We do not store your files or your transcript. Close the tab and it is gone.',
  },
  steps: {
    heading: 'Three steps',
    one: 'Pick a video from your device (up to 10 minutes).',
    two: 'We transcribe it locally and you choose a caption style.',
    three: 'Export a finished MP4 with the captions burned in.',
  },
  upload: {
    drop: 'Drop a video here',
    browse: 'or click to choose a file',
    hint: 'MP4, MOV or WebM · up to 10 minutes',
    tooLong: 'That video is longer than 10 minutes. Please use a shorter clip.',
    invalid: 'That file does not look like a video. Try an MP4, MOV or WebM.',
    selected: 'Selected',
  },
  presets: {
    heading: 'Caption style',
    free: 'Free',
    basic: 'Unlock with email',
    premium: 'Premium',
    locked: 'Locked',
    unlock: 'Get the free pack',
    buy: 'Get premium',
  },
  email: {
    heading: 'Unlock two more styles, free',
    desc: 'Drop your email and we will unlock two extra caption styles. No spam, unsubscribe anytime.',
    placeholder: 'you@example.com',
    submit: 'Unlock styles',
    submitting: 'Unlocking…',
    success: 'Unlocked. Enjoy the extra styles!',
    error: 'Something went wrong. Please try again.',
    invalid: 'Please enter a valid email address.',
    waiting: 'One moment, verifying…',
    consentPrefix: 'I agree to the',
    tos: 'Terms',
    and: 'and',
    privacy: 'Privacy Policy',
  },
  exportUi: {
    heading: 'Export',
    button: 'Export MP4',
    rendering: 'Rendering…',
    cancel: 'Cancel',
    done: 'Done',
    download: 'Download MP4',
    unsupported:
      'In-browser export needs Chrome or Edge. Please open this page in one of those browsers.',
  },
  transcribe: {
    loadingModel: 'Loading the speech model (one-time download)…',
    transcribing: 'Transcribing your video locally…',
    ready: 'Transcript ready',
  },
  footer: {
    tagline: 'Local, private captioning by TechSkills Academy.',
    tos: 'Terms',
    privacy: 'Privacy',
    source: 'Source on GitHub',
  },
};
