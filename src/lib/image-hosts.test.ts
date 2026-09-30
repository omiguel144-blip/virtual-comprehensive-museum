import { describe, expect, it } from "vitest";
import { isAllowedImageHost } from "./image-hosts";

describe("isAllowedImageHost", () => {
  it("allows the museum image hosts over https", () => {
    expect(isAllowedImageHost("https://images.metmuseum.org/CRDImages/ep/original/DT1567.jpg")).toBe(true);
    expect(isAllowedImageHost("https://www.artic.edu/iiif/2/abc/full/843,/0/default.jpg")).toBe(true);
    expect(isAllowedImageHost("https://openaccess-cdn.clevelandart.org/1/1_web.jpg")).toBe(true);
  });

  it("refuses other hosts, lookalikes, and plain http", () => {
    expect(isAllowedImageHost("https://example.org/a.jpg")).toBe(false);
    expect(isAllowedImageHost("https://images.metmuseum.org.evil.com/a.jpg")).toBe(false);
    expect(isAllowedImageHost("http://www.artic.edu/iiif/2/a")).toBe(false);
    expect(isAllowedImageHost("not a url")).toBe(false);
  });
});
