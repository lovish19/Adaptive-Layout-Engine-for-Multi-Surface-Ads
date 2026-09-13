// Execute inside the running app with agent-browser eval --stdin (see README).
(async () => {
  const results = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const settle = () =>
    new Promise((resolve) => {
      const timer = setTimeout(resolve, 120);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          clearTimeout(timer);
          resolve();
        }),
      );
    });
  const button = (text) =>
    [...document.querySelectorAll("button")].find(
      (el) =>
        el.textContent.trim().startsWith(text) ||
        el.querySelector("strong")?.textContent === text,
    );
  const click = async (text) => {
    const target = button(text);
    assert(target, `Missing ${text}`);
    target.click();
    await settle();
  };
  const setInput = async (label, value) => {
    const field = [...document.querySelectorAll("label")]
      .find((el) => el.textContent.trim() === label)
      ?.querySelector("input");
    assert(field, `Missing input ${label}`);
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(field, String(value));
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  };
  const geometry = () => {
    const canvas = document.querySelector(".ad-canvas");
    assert(canvas, "Missing resolved ad");
    const parent = canvas.getBoundingClientRect();
    const boxes = [...canvas.querySelectorAll(".ad-element")].map((el) => ({
      el,
      box: el.getBoundingClientRect(),
    }));
    for (const { el, box } of boxes) {
      assert(box.width > 0 && box.height > 0, "Empty geometry");
      assert(
        box.left >= parent.left - 0.1 &&
          box.top >= parent.top - 0.1 &&
          box.right <= parent.right + 0.1 &&
          box.bottom <= parent.bottom + 0.1,
        `${el.dataset.element} outside surface`,
      );
      for (const line of el.querySelectorAll(".ad-lines > span")) {
        const range = document.createRange();
        range.selectNodeContents(line);
        const ink = range.getBoundingClientRect();
        assert(
          ink.right <= box.right + 0.6 && ink.left >= box.left - 0.6,
          `${el.dataset.element} text spills horizontally`,
        );
        assert(
          ink.bottom <= box.bottom + 1 && ink.top >= box.top - 1,
          `${el.dataset.element} text spills vertically`,
        );
      }
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].box,
          b = boxes[j].box;
        assert(
          a.right <= b.left + 0.1 ||
            b.right <= a.left + 0.1 ||
            a.bottom <= b.top + 0.1 ||
            b.bottom <= a.top + 0.1,
          "Overlapping DOM elements",
        );
      }
    return { composition: canvas.dataset.composition, visible: boxes.length };
  };
  const luminance = (rgb) =>
    rgb
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (element) => {
    const rgb = (color) => color.match(/[\d.]+/g).map(Number);
    const foreground = rgb(getComputedStyle(element).color).slice(0, 3);
    let background = [255, 255, 255];
    for (let parent = element; parent; parent = parent.parentElement) {
      const color = rgb(getComputedStyle(parent).backgroundColor);
      if (color.length === 3 || color[3] === 1) {
        background = color.slice(0, 3);
        break;
      }
    }
    const a = luminance(foreground),
      b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  await Promise.race([
    document.fonts.ready,
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  await settle();
  assert(!document.querySelector("vite-error-overlay"), "Vite error overlay");
  for (const [name, expected] of [
    ["Mobile Portrait", "stack"],
    ["Mobile Landscape", "split"],
    ["Broadcast Lower Third", "inline"],
    ["Square Kiosk", "split"],
  ]) {
    await click(name);
    const actual = geometry();
    assert(
      actual.composition === expected,
      `${name}: unexpected composition ${actual.composition}`,
    );
    results.push({ name, ...actual });
  }
  const ratios = [
    ...document.querySelectorAll(
      ".inspector-intro,.constraint-facts dt,.surface-option small,.result-badge,.outcome-name small",
    ),
  ].map(contrast);
  assert(
    ratios.every((value) => value >= 4.5),
    `Small-label contrast below 4.5:1: ${Math.min(...ratios)}`,
  );
  results.push({
    name: "small-label contrast",
    minimumRatio: Math.min(...ratios),
  });
  await click("Broadcast Lower Third");
  const sizeButton = document.querySelector(
    ".surface-preview .preview-size-button",
  );
  const beforeSizing = document.querySelector(".ad-canvas").innerHTML;
  sizeButton.click();
  await settle();
  assert(
    document.querySelector(".ad-canvas").getBoundingClientRect().width === 1920,
    "100% preview is not actual size",
  );
  assert(
    document.documentElement.scrollWidth <= innerWidth,
    "Actual-size preview should scroll inside its frame",
  );
  sizeButton.click();
  await settle();
  assert(
    document.querySelector(".ad-canvas").innerHTML === beforeSizing,
    "Preview zoom changed resolved content",
  );
  await click("Square Kiosk");
  const bounds = document.querySelector(".bounds-toggle input");
  bounds.click();
  await settle();
  assert(
    document.querySelector(".usable-bounds") &&
      document.querySelectorAll(".element-tag").length === 5,
    "Bounds toggle",
  );
  bounds.click();
  await settle();
  document.querySelector(".ad-button a").click();
  await settle();
  assert(
    document.querySelector("dialog").open,
    "CTA did not open product destination",
  );
  await click("Back to the experiment");
  assert(
    !document.querySelector("dialog").open,
    "Product dialog did not close",
  );
  await click("All surfaces");
  assert(
    document.querySelectorAll(".ad-canvas").length === 4,
    "Comparison does not contain four resolved surfaces",
  );
  results.push({ name: "comparison", canvases: 4 });
  document.querySelector(".comparison-preview .preview-size-button").click();
  await settle();
  assert(
    document.querySelectorAll(".ad-canvas").length === 1,
    "Inspect should select one comparison surface",
  );
  await click("Custom Surface");
  await setInput("Width (px)", 820);
  await setInput("Height (px)", 310);
  await setInput("top", 18);
  await setInput("right", 24);
  await setInput("bottom", 18);
  await setInput("left", 24);
  await setInput("Minimum tap target (px)", 48);
  await setInput("Padding (px)", 12);
  await setInput("Gap (px)", 10);
  await setInput("Text floor (px)", 14);
  await setInput("Distance (m)", 0.4);
  const touch = document.querySelector(".toggle-label input");
  if (!touch.checked) {
    touch.click();
    await settle();
  }
  results.push({
    name: "exact interview surface 820 x 310, insets 18/24/18/24, 48px taps",
    ...geometry(),
  });
  const cta = document.querySelector(".ad-button");
  assert(
    parseFloat(cta.style.width) >= 48 && parseFloat(cta.style.height) >= 48,
    "Interview CTA target below 48px",
  );
  await setInput("Width (px)", 0);
  assert(
    !document.querySelector(".ad-canvas") &&
      document.querySelector(".resolution-error"),
    "Invalid surface should render a clear error",
  );
  await setInput("Width (px)", 820);
  geometry();
  const preset = document.querySelector("#preset");
  for (const id of ["custom-signage", "custom-strip", "custom-card"]) {
    preset.value = id;
    preset.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    results.push({ name: id, ...geometry() });
  }
  const textarea = document.querySelector("#headline");
  const setHeadline = async (text) => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    ).set.call(textarea, text);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  };
  await setHeadline("");
  assert(
    document.querySelector(".resolution-error") &&
      !document.querySelector(".ad-canvas"),
    "Missing required headline not reported",
  );
  await setHeadline("A little less noise. A little more space for yourself.");
  geometry();
  await setHeadline("Less noise.\nMore feeling.");
  let exported;
  const original = URL.createObjectURL;
  URL.createObjectURL = (blob) => {
    exported = blob;
    return original.call(URL, blob);
  };
  try {
    await click("Export JSON");
  } finally {
    URL.createObjectURL = original;
  }
  const data = JSON.parse(await exported.text());
  assert(
    data.spec.elements.length === 5 &&
      data.result.layout.status === "resolved" &&
      data.result.surface.id === "custom",
    "Export omitted source or resolved data",
  );
  results.push({
    name: "export JSON",
    elements: data.spec.elements.length,
    status: data.result.layout.status,
  });
  await click("Mobile Portrait");
  assert(
    [...document.images]
      .filter((img) => img.getBoundingClientRect().width > 0)
      .every((img) => img.complete && img.naturalWidth > 0),
    "Image did not load",
  );
  assert(
    !performance
      .getEntriesByType("resource")
      .some((entry) => !entry.name.startsWith(location.origin)),
    "External runtime resource",
  );
  assert(
    document.documentElement.scrollWidth <= innerWidth,
    "Page overflows horizontally",
  );
  return {
    passed: true,
    results,
    checks: [
      "DOM geometry and text bounds",
      "required surface composition",
      "small-label contrast",
      "100% preview and comparison inspection",
      "bounds overlay",
      "CTA dialog",
      "comparison",
      "exact interview profile",
      "custom presets",
      "invalid input and recovery",
      "edited headline",
      "JSON export",
      "local assets",
    ],
  };
})();
