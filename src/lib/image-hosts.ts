/** Image hosts the importers approve images from. Anything else is refused. */
const ALLOWED_IMAGE_HOSTS = new Set([
  "images.metmuseum.org",
  "www.artic.edu",
  "openaccess-cdn.clevelandart.org",
]);

export function isAllowedImageHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_IMAGE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}
