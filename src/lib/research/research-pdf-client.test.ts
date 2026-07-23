import { describe, expect, it } from "vitest";

import { measureBlockBandsPx } from "./research-pdf-client";

function elementAt(top: number, bottom = top) {
  return {
    getBoundingClientRect: () => ({ top, bottom }),
  } as HTMLElement;
}

describe("measureBlockBandsPx", () => {
  it("ends every band exactly where the next block starts", () => {
    const body = elementAt(0);
    const blocks = [
      elementAt(40, 80),
      elementAt(92, 220),
      elementAt(236, 260),
    ];

    expect(measureBlockBandsPx(blocks, body, 2, 600)).toEqual([
      { topPx: 80, heightPx: 104 },
      { topPx: 184, heightPx: 288 },
      { topPx: 472, heightPx: 128 },
    ]);
  });

  it("never includes pixels from the following block", () => {
    const body = elementAt(10);
    const blocks = [elementAt(20, 30), elementAt(30, 60)];

    const [first, second] = measureBlockBandsPx(blocks, body, 2, 140);

    expect(first.topPx + first.heightPx).toBe(second.topPx);
  });
});
