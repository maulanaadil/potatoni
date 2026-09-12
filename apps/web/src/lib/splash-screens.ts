// iOS shows these while an installed Potatoni launches (Android builds its own from the manifest).
// CSS size × pixel ratio per device; scripts/generate-splash-screens.ts renders one PNG per orientation.
const DEVICES = [
  { width: 440, height: 956, ratio: 3 }, // iPhone 16 Pro Max
  { width: 402, height: 874, ratio: 3 }, // iPhone 16 Pro
  { width: 430, height: 932, ratio: 3 }, // iPhone 16 Plus / 15 Pro Max / 14 Pro Max
  { width: 393, height: 852, ratio: 3 }, // iPhone 16 / 15 / 14 Pro
  { width: 428, height: 926, ratio: 3 }, // iPhone 14 Plus / 13 Pro Max / 12 Pro Max
  { width: 390, height: 844, ratio: 3 }, // iPhone 14 / 13 / 12
  { width: 375, height: 812, ratio: 3 }, // iPhone 13 mini / 12 mini / 11 Pro / X
  { width: 414, height: 896, ratio: 3 }, // iPhone 11 Pro Max / XS Max
  { width: 414, height: 896, ratio: 2 }, // iPhone 11 / XR
  { width: 414, height: 736, ratio: 3 }, // iPhone 8 Plus
  { width: 375, height: 667, ratio: 2 }, // iPhone SE / 8
  { width: 1032, height: 1376, ratio: 2 }, // iPad Pro 13" (M4)
  { width: 1024, height: 1366, ratio: 2 }, // iPad Pro 12.9"
  { width: 834, height: 1210, ratio: 2 }, // iPad Pro 11" (M4)
  { width: 834, height: 1194, ratio: 2 }, // iPad Pro 11"
  { width: 820, height: 1180, ratio: 2 }, // iPad Air / iPad (10th gen)
  { width: 834, height: 1112, ratio: 2 }, // iPad Air 10.5"
  { width: 810, height: 1080, ratio: 2 }, // iPad (9th gen)
  { width: 744, height: 1133, ratio: 2 }, // iPad mini (6th gen)
  { width: 768, height: 1024, ratio: 2 }, // iPad mini / older iPad
] as const;

const ORIENTATIONS = ["portrait", "landscape"] as const;

export const SPLASH_SCREENS = DEVICES.flatMap(({ width, height, ratio }) =>
  ORIENTATIONS.map((orientation) => {
    const portrait = orientation === "portrait";
    return {
      file: `splash-${width}x${height}@${ratio}x-${orientation}.png`,
      pixelWidth: (portrait ? width : height) * ratio,
      pixelHeight: (portrait ? height : width) * ratio,
      media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: ${orientation})`,
    };
  }),
);

/** The icon's share of the shorter screen edge — the in-app LaunchSplash uses the same (28vmin). */
export const SPLASH_ICON_SCALE = 0.28;

export const appleStartupImages = SPLASH_SCREENS.map(({ file, media }) => ({ url: `/splash/${file}`, media }));
