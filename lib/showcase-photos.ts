/**
 * Public Pacific Baseball action photos from goboxers.com (owner request, November 14), used as
 * decorative backgrounds on the Home hero and sign-in page. Loaded with no referrer, like headshots.
 */
const photo = (path: string, width: number) => `https://goboxers.com${path}?width=${width}&quality=80`;
export const HOME_HERO_PHOTO = photo("/images/2026/4/18/20260228_MBvWillamette_-64.jpg", 1600);
export const SIGN_IN_PHOTO = photo("/images/2026/5/26/20260228_MBvWillamette_-52.jpg", 1400);
